import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { isReNetworkEnabled } from './re-access';

@Injectable()
export class ReNetworkService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private client() {
    return this.supabaseService.getServiceClient();
  }

  private assertNetwork() {
    if (!isReNetworkEnabled()) {
      throw new ForbiddenException('RE_NETWORK_ENABLED is disabled');
    }
  }

  async notify(opts: {
    organizationId: string;
    userId: string;
    kind: string;
    title: string;
    body?: string;
    href?: string;
    entityType?: string;
    entityId?: string;
  }) {
    await this.client().from('re_notifications').insert({
      organization_id: opts.organizationId,
      user_id: opts.userId,
      kind: opts.kind,
      title: opts.title,
      body: opts.body || null,
      href: opts.href || null,
      entity_type: opts.entityType || null,
      entity_id: opts.entityId || null,
    });
  }

  // --- Feed / posts ---

  async listFeed(organizationId: string, userId: string, limit = 30, cursor?: string) {
    this.assertNetwork();
    let q = this.client()
      .from('re_posts')
      .select(
        'id, organization_id, author_user_id, author_profile_id, post_type, body, visibility, listing_id, metadata, reaction_count, comment_count, repost_count, created_at',
      )
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 50));
    if (cursor) q = q.lt('created_at', cursor);
    const { data: posts, error } = await q;
    if (error) throw new BadRequestException(error.message);

    const ids = (posts || []).map((p) => p.id);
    let myReactions: Record<string, string> = {};
    if (ids.length) {
      const { data: rx } = await this.client()
        .from('re_post_reactions')
        .select('post_id, reaction')
        .eq('user_id', userId)
        .in('post_id', ids);
      for (const r of rx || []) myReactions[r.post_id] = r.reaction;
    }

    const listingIds = [...new Set((posts || []).map((p) => p.listing_id).filter(Boolean))];
    let listings: Record<string, any> = {};
    if (listingIds.length) {
      const { data: ls } = await this.client()
        .from('re_listings')
        .select('id, title, city, locality, price, currency, cover_image_url, listing_type, bedrooms, bathrooms')
        .in('id', listingIds);
      for (const l of ls || []) listings[l.id] = l;
    }

    const profileIds = [...new Set((posts || []).map((p) => p.author_profile_id).filter(Boolean))];
    let profiles: Record<string, any> = {};
    if (profileIds.length) {
      const { data: ps } = await this.client()
        .from('re_profiles')
        .select('id, display_name, headline, avatar_url, profile_type')
        .in('id', profileIds);
      for (const p of ps || []) profiles[p.id] = p;
    }

    return {
      posts: (posts || []).map((p) => ({
        ...p,
        my_reaction: myReactions[p.id] || null,
        listing: p.listing_id ? listings[p.listing_id] || null : null,
        author: p.author_profile_id ? profiles[p.author_profile_id] || null : null,
      })),
      nextCursor: posts?.length ? posts[posts.length - 1].created_at : null,
    };
  }

  async createPost(opts: {
    organizationId: string;
    userId: string;
    body: string;
    postType?: string;
    visibility?: string;
    listingId?: string | null;
    authorProfileId?: string | null;
    mediaUrls?: string[];
  }) {
    this.assertNetwork();
    const body = String(opts.body || '').trim();
    if (!body && !opts.listingId && !(opts.mediaUrls || []).length) {
      throw new BadRequestException('Post body or media required');
    }
    const { data, error } = await this.client()
      .from('re_posts')
      .insert({
        organization_id: opts.organizationId,
        author_user_id: opts.userId,
        author_profile_id: opts.authorProfileId || null,
        post_type: opts.postType || (opts.listingId ? 'property' : 'text'),
        body,
        visibility: opts.visibility || 'org',
        listing_id: opts.listingId || null,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    if (opts.mediaUrls?.length) {
      await this.client().from('re_post_media').insert(
        opts.mediaUrls.map((url, i) => ({
          post_id: data.id,
          url,
          sort_order: i,
        })),
      );
    }
    return { post: data };
  }

  async reactToPost(opts: {
    organizationId: string;
    userId: string;
    postId: string;
    reaction?: string;
  }) {
    this.assertNetwork();
    const { data: post } = await this.client()
      .from('re_posts')
      .select('id, author_user_id, organization_id, reaction_count')
      .eq('id', opts.postId)
      .eq('organization_id', opts.organizationId)
      .maybeSingle();
    if (!post) throw new NotFoundException('Post not found');

    const { data: existing } = await this.client()
      .from('re_post_reactions')
      .select('id')
      .eq('post_id', opts.postId)
      .eq('user_id', opts.userId)
      .maybeSingle();

    if (existing) {
      await this.client().from('re_post_reactions').delete().eq('id', existing.id);
      await this.client()
        .from('re_posts')
        .update({ reaction_count: Math.max(0, (post.reaction_count || 1) - 1) })
        .eq('id', post.id);
      return { reacted: false };
    }

    const { error } = await this.client().from('re_post_reactions').insert({
      post_id: opts.postId,
      user_id: opts.userId,
      reaction: opts.reaction || 'like',
    });
    if (error) throw new BadRequestException(error.message);
    await this.client()
      .from('re_posts')
      .update({ reaction_count: (post.reaction_count || 0) + 1 })
      .eq('id', post.id);
    if (post.author_user_id !== opts.userId) {
      await this.notify({
        organizationId: opts.organizationId,
        userId: post.author_user_id,
        kind: 'reaction',
        title: 'New reaction on your post',
        href: `/re/home`,
        entityType: 'post',
        entityId: post.id,
      });
    }
    return { reacted: true };
  }

  async listComments(organizationId: string, postId: string, limit = 50) {
    this.assertNetwork();
    const { data, error } = await this.client()
      .from('re_comments')
      .select('id, post_id, author_user_id, parent_comment_id, body, created_at')
      .eq('organization_id', organizationId)
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (error) throw new BadRequestException(error.message);
    return { comments: data || [] };
  }

  async addComment(opts: {
    organizationId: string;
    userId: string;
    postId: string;
    body: string;
    parentCommentId?: string | null;
  }) {
    this.assertNetwork();
    const body = String(opts.body || '').trim();
    if (!body) throw new BadRequestException('Comment required');
    const { data: post } = await this.client()
      .from('re_posts')
      .select('id, author_user_id, comment_count')
      .eq('id', opts.postId)
      .eq('organization_id', opts.organizationId)
      .maybeSingle();
    if (!post) throw new NotFoundException('Post not found');

    const { data, error } = await this.client()
      .from('re_comments')
      .insert({
        organization_id: opts.organizationId,
        post_id: opts.postId,
        author_user_id: opts.userId,
        parent_comment_id: opts.parentCommentId || null,
        body,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    await this.client()
      .from('re_posts')
      .update({ comment_count: (post.comment_count || 0) + 1 })
      .eq('id', post.id);
    if (post.author_user_id !== opts.userId) {
      await this.notify({
        organizationId: opts.organizationId,
        userId: post.author_user_id,
        kind: 'comment',
        title: 'New comment on your post',
        body,
        href: `/re/home`,
        entityType: 'post',
        entityId: post.id,
      });
    }
    return { comment: data };
  }

  // --- Connections ---

  async searchProfessionals(organizationId: string, q: string, limit = 30) {
    this.assertNetwork();
    let query = this.client()
      .from('re_profiles')
      .select(
        'id, display_name, headline, avatar_url, location_text, profile_type, user_id, is_company_page',
      )
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .limit(Math.min(Math.max(limit, 1), 50));
    if (q?.trim()) {
      query = query.or(
        `display_name.ilike.%${q.trim()}%,headline.ilike.%${q.trim()}%,location_text.ilike.%${q.trim()}%`,
      );
    }
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return { profiles: data || [] };
  }

  async requestConnection(opts: {
    organizationId: string;
    requesterUserId: string;
    addresseeUserId: string;
  }) {
    this.assertNetwork();
    if (opts.requesterUserId === opts.addresseeUserId) {
      throw new BadRequestException('Cannot connect to yourself');
    }
    const { data, error } = await this.client()
      .from('re_connections')
      .upsert(
        {
          organization_id: opts.organizationId,
          requester_user_id: opts.requesterUserId,
          addressee_user_id: opts.addresseeUserId,
          status: 'pending',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,requester_user_id,addressee_user_id' },
      )
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    await this.notify({
      organizationId: opts.organizationId,
      userId: opts.addresseeUserId,
      kind: 'connection_request',
      title: 'New connection request',
      href: '/re/network',
      entityType: 'connection',
      entityId: data.id,
    });
    return { connection: data };
  }

  async respondConnection(opts: {
    organizationId: string;
    userId: string;
    connectionId: string;
    accept: boolean;
  }) {
    this.assertNetwork();
    const { data: row } = await this.client()
      .from('re_connections')
      .select('*')
      .eq('id', opts.connectionId)
      .eq('organization_id', opts.organizationId)
      .maybeSingle();
    if (!row) throw new NotFoundException('Connection not found');
    if (row.addressee_user_id !== opts.userId) {
      throw new ForbiddenException('Only the addressee can respond');
    }
    const status = opts.accept ? 'accepted' : 'declined';
    const { data, error } = await this.client()
      .from('re_connections')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    if (opts.accept) {
      await this.notify({
        organizationId: opts.organizationId,
        userId: row.requester_user_id,
        kind: 'connection_accepted',
        title: 'Connection accepted',
        href: '/re/network',
        entityType: 'connection',
        entityId: row.id,
      });
    }
    return { connection: data };
  }

  async listConnections(organizationId: string, userId: string) {
    this.assertNetwork();
    const { data, error } = await this.client()
      .from('re_connections')
      .select('*')
      .eq('organization_id', organizationId)
      .or(`requester_user_id.eq.${userId},addressee_user_id.eq.${userId}`)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) throw new BadRequestException(error.message);
    return { connections: data || [] };
  }

  async follow(opts: {
    organizationId: string;
    followerUserId: string;
    followingUserId: string;
  }) {
    this.assertNetwork();
    if (opts.followerUserId === opts.followingUserId) {
      throw new BadRequestException('Cannot follow yourself');
    }
    const { data, error } = await this.client()
      .from('re_follows')
      .upsert(
        {
          organization_id: opts.organizationId,
          follower_user_id: opts.followerUserId,
          following_user_id: opts.followingUserId,
        },
        { onConflict: 'organization_id,follower_user_id,following_user_id' },
      )
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { follow: data };
  }

  async unfollow(opts: {
    organizationId: string;
    followerUserId: string;
    followingUserId: string;
  }) {
    this.assertNetwork();
    await this.client()
      .from('re_follows')
      .delete()
      .eq('organization_id', opts.organizationId)
      .eq('follower_user_id', opts.followerUserId)
      .eq('following_user_id', opts.followingUserId);
    return { ok: true };
  }

  // --- Messaging ---

  async listConversations(organizationId: string, userId: string) {
    this.assertNetwork();
    const { data: memberships, error } = await this.client()
      .from('re_conversation_members')
      .select('conversation_id, last_read_at, muted')
      .eq('user_id', userId);
    if (error) throw new BadRequestException(error.message);
    const ids = (memberships || []).map((m) => m.conversation_id);
    if (!ids.length) return { conversations: [] };

    const { data: convs } = await this.client()
      .from('re_conversations')
      .select('*')
      .eq('organization_id', organizationId)
      .in('id', ids)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    const { data: lastMsgs } = await this.client()
      .from('re_messages')
      .select('id, conversation_id, body, sender_user_id, created_at')
      .in('conversation_id', ids)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(ids.length * 3);

    const latestByConv: Record<string, any> = {};
    for (const m of lastMsgs || []) {
      if (!latestByConv[m.conversation_id]) latestByConv[m.conversation_id] = m;
    }
    const memMap = Object.fromEntries((memberships || []).map((m) => [m.conversation_id, m]));

    return {
      conversations: (convs || []).map((c) => ({
        ...c,
        last_message: latestByConv[c.id] || null,
        membership: memMap[c.id] || null,
      })),
    };
  }

  async openDirectConversation(opts: {
    organizationId: string;
    userId: string;
    otherUserId: string;
  }) {
    this.assertNetwork();
    if (opts.userId === opts.otherUserId) {
      throw new BadRequestException('Cannot message yourself');
    }
    // Find existing 1:1
    const { data: mine } = await this.client()
      .from('re_conversation_members')
      .select('conversation_id')
      .eq('user_id', opts.userId);
    const myIds = (mine || []).map((m) => m.conversation_id);
    if (myIds.length) {
      const { data: theirs } = await this.client()
        .from('re_conversation_members')
        .select('conversation_id')
        .eq('user_id', opts.otherUserId)
        .in('conversation_id', myIds);
      for (const t of theirs || []) {
        const { data: conv } = await this.client()
          .from('re_conversations')
          .select('*')
          .eq('id', t.conversation_id)
          .eq('organization_id', opts.organizationId)
          .eq('is_group', false)
          .maybeSingle();
        if (conv) return { conversation: conv };
      }
    }

    const { data: conv, error } = await this.client()
      .from('re_conversations')
      .insert({
        organization_id: opts.organizationId,
        is_group: false,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    await this.client().from('re_conversation_members').insert([
      { conversation_id: conv.id, user_id: opts.userId },
      { conversation_id: conv.id, user_id: opts.otherUserId },
    ]);
    return { conversation: conv };
  }

  async listMessages(opts: {
    organizationId: string;
    userId: string;
    conversationId: string;
    limit?: number;
  }) {
    this.assertNetwork();
    await this.assertMember(opts.conversationId, opts.userId);
    const { data, error } = await this.client()
      .from('re_messages')
      .select('id, conversation_id, sender_user_id, body, listing_id, created_at')
      .eq('conversation_id', opts.conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(Math.min(Math.max(opts.limit || 100, 1), 200));
    if (error) throw new BadRequestException(error.message);
    await this.client()
      .from('re_conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', opts.conversationId)
      .eq('user_id', opts.userId);
    return { messages: data || [] };
  }

  async sendMessage(opts: {
    organizationId: string;
    userId: string;
    conversationId: string;
    body: string;
    listingId?: string | null;
  }) {
    this.assertNetwork();
    await this.assertMember(opts.conversationId, opts.userId);
    const body = String(opts.body || '').trim();
    if (!body) throw new BadRequestException('Message required');
    const { data, error } = await this.client()
      .from('re_messages')
      .insert({
        conversation_id: opts.conversationId,
        sender_user_id: opts.userId,
        body,
        listing_id: opts.listingId || null,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    await this.client()
      .from('re_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.conversationId);

    const { data: members } = await this.client()
      .from('re_conversation_members')
      .select('user_id')
      .eq('conversation_id', opts.conversationId);
    for (const m of members || []) {
      if (m.user_id === opts.userId) continue;
      await this.notify({
        organizationId: opts.organizationId,
        userId: m.user_id,
        kind: 'message',
        title: 'New message',
        body: body.slice(0, 120),
        href: '/re/messages',
        entityType: 'conversation',
        entityId: opts.conversationId,
      });
    }
    return { message: data };
  }

  private async assertMember(conversationId: string, userId: string) {
    const { data } = await this.client()
      .from('re_conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) throw new ForbiddenException('Not a conversation member');
  }

  // --- Notifications ---

  async listNotifications(userId: string, limit = 40) {
    this.assertNetwork();
    const { data, error } = await this.client()
      .from('re_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (error) throw new BadRequestException(error.message);
    return { notifications: data || [] };
  }

  async markNotificationsRead(userId: string, ids?: string[]) {
    this.assertNetwork();
    let q = this.client()
      .from('re_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
    if (ids?.length) q = q.in('id', ids);
    const { error } = await q;
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  // --- Profile social update ---

  async updateSocialProfile(
    organizationId: string,
    profileId: string,
    patch: Record<string, unknown>,
  ) {
    this.assertNetwork();
    const allowed = [
      'headline',
      'bio',
      'avatar_url',
      'cover_url',
      'location_text',
      'service_areas',
      'specializations',
      'languages',
      'website_url',
      'visibility',
      'display_name',
    ];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (patch[k] !== undefined) updates[k] = patch[k];
    }
    const { data, error } = await this.client()
      .from('re_profiles')
      .update(updates)
      .eq('id', profileId)
      .eq('organization_id', organizationId)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { profile: data };
  }

  async getPublicProfile(organizationId: string, profileId: string) {
    this.assertNetwork();
    const { data, error } = await this.client()
      .from('re_profiles')
      .select(
        'id, display_name, headline, bio, avatar_url, cover_url, location_text, service_areas, specializations, languages, website_url, profile_type, user_id, is_company_page, visibility',
      )
      .eq('id', profileId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Profile not found');

    const { data: listings } = await this.client()
      .from('re_listings')
      .select(
        'id, title, city, locality, price, currency, cover_image_url, listing_type, bedrooms, bathrooms, status',
      )
      .eq('organization_id', organizationId)
      .eq('owner_profile_id', profileId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(12);

    return { profile: data, listings: listings || [] };
  }
}
