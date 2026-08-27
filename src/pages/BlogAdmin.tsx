import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import PageContent from '@/components/PageContent';
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBlogAdmin } from '@/hooks/useBlogPosts';
import type { BlogPostRecord } from '@/types/blog';
import { slugifyTitle } from '@/types/blog';
import { ExternalLink, FileUp, Loader2, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { STATIC_BLOG_POSTS_PATH } from '@/content/blog/posts';
type Draft = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  content_html: string;
  cover_image_url: string;
  author_name: string;
  author_title: string;
  tags: string;
  published: boolean;
};

const emptyDraft = (): Draft => ({
  title: '',
  slug: '',
  description: '',
  content_html: '',
  cover_image_url: '',
  author_name: 'TopSqill Team',
  author_title: 'Product',
  tags: '',
  published: false,
});

function recordToDraft(row: BlogPostRecord): Draft {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description || '',
    content_html: row.content_html || '',
    cover_image_url: row.cover_image_url || '',
    author_name: row.author_name || 'TopSqill Team',
    author_title: row.author_title || '',
    tags: (row.tags || []).join(', '),
    published: row.published,
  };
}

export default function BlogAdmin() {
  const { userProfile } = useAuth();
  const {
    posts,
    isLoading,
    createPost,
    updatePost,
    deletePost,
    uploadCover,
    cmsMode,
    ensureSetup,
    listError,
  } = useBlogAdmin();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [ensuring, setEnsuring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saving = createPost.isPending || updatePost.isPending;

  const sorted = useMemo(
    () => [...posts].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))),
    [posts],
  );

  if (userProfile?.role !== 'admin') {
    return (
      <PageContent title="Access Denied">
        <Card>
          <CardHeader>
            <CardTitle>Admins only</CardTitle>
            <CardDescription>
              Blog publishing is limited to organization admins. Ask an admin for access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </PageContent>
    );
  }

  const openCreate = () => {
    setDraft(emptyDraft());
    setSlugTouched(false);
    setOpen(true);
  };

  const openEdit = (row: BlogPostRecord) => {
    setDraft(recordToDraft(row));
    setSlugTouched(true);
    setOpen(true);
  };

  const onTitleChange = (title: string) => {
    setDraft((d) => ({
      ...d,
      title,
      slug: slugTouched ? d.slug : slugifyTitle(title),
    }));
  };

  const save = async () => {
    if (!draft.title.trim() || !draft.slug.trim()) {
      toast.error('Title and slug are required');
      return;
    }
    const payload = {
      title: draft.title.trim(),
      slug: slugifyTitle(draft.slug),
      description: draft.description.trim(),
      content_html: draft.content_html || '',
      cover_image_url: draft.cover_image_url.trim() || null,
      author_name: draft.author_name.trim() || 'TopSqill Team',
      author_title: draft.author_title.trim() || null,
      tags: draft.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      published: draft.published,
    };
    if (draft.id) {
      await updatePost.mutateAsync({ id: draft.id, ...payload });
    } else {
      await createPost.mutateAsync(payload);
    }
    setOpen(false);
  };

  const onCoverPick = async (file: File | null) => {
    if (!file) return;
    try {
      setUploading(true);
      const result = await uploadCover(file);
      setDraft((d) => ({ ...d, cover_image_url: result.url }));
      if (result.via === 'data-url') {
        toast.success('Cover embedded in the post (Storage buckets unavailable)');
      } else {
        toast.success(`Cover uploaded${result.bucket ? ` to ${result.bucket}` : ''}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const runImport = async () => {
    try {
      const parsed = JSON.parse(importText);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      let count = 0;
      for (const item of items) {
        const title = String(item.title || '').trim();
        const slug = slugifyTitle(String(item.slug || title));
        if (!title || !slug) continue;
        const content_html = String(
          item.content_html
          || item.contentHtml
          || (Array.isArray(item.body) ? item.body.map((p: string) => `<p>${p}</p>`).join('') : '')
          || item.content
          || '',
        );
        await createPost.mutateAsync({
          title,
          slug,
          description: String(item.description || ''),
          content_html,
          cover_image_url: item.cover_image_url || item.coverImageUrl || null,
          author_name: item.author_name || item.authorName || 'TopSqill Team',
          author_title: item.author_title || item.authorTitle || null,
          tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
          published: Boolean(item.published ?? false),
        });
        count += 1;
      }
      toast.success(`Imported ${count} post${count === 1 ? '' : 's'}`);
      setImportOpen(false);
      setImportText('');
    } catch (err: any) {
      toast.error(err?.message || 'Invalid JSON — expected an object or array of posts');
    }
  };

  const runEnsure = async () => {
    try {
      setEnsuring(true);
      const data = await ensureSetup();
      toast.success(data?.message || 'Blog storage checked');
    } catch (err: any) {
      toast.error(err?.message || 'Could not ensure blog storage (backend may be offline — uploads still fall back to report-media)');
    } finally {
      setEnsuring(false);
    }
  };

  return (
    <PageContent
      title="Blog admin"
      description="Create and publish posts for the public /blog page. Admins only."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void runEnsure()} disabled={ensuring}>
            {ensuring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
            Fix storage
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp className="h-4 w-4 mr-2" />
            Import JSON
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New post
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where posts come from</CardTitle>
            <CardDescription>
              The landing <code className="text-xs">/blog</code> page merges two sources.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Built-in articles</span>
              {' '}live in the repo at{' '}
              <code className="text-xs text-foreground">{STATIC_BLOG_POSTS_PATH}</code>
              {' '}(shipped with the site). They show until you publish a CMS post with the same URL slug.
            </p>
            <p>
              <span className="font-medium text-foreground">CMS posts</span>
              {' '}(this page) are stored in Supabase
              {cmsMode === 'table' ? ' table blog_posts' : ' Storage (blog/cms-posts.json)'}
              {' '}and appear on /blog when Published is on.
            </p>
            {listError && (
              <p className="text-destructive text-sm">{listError}</p>
            )}
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
              <CardTitle className="text-base">All CMS posts</CardTitle>
              <CardDescription>
                Drafts stay private on the public site. Published posts appear immediately on /blog.
                {cmsMode === 'storage' ? ' Using storage fallback until the blog_posts migration is applied.' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : sorted.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No CMS posts yet. Create one or import JSON. Static seed posts still show on /blog until replaced.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {sorted.map((row) => (
                    <li key={row.id} className="py-4 flex flex-wrap items-center gap-3 justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium truncate">{row.title}</p>
                          <Badge variant={row.published ? 'default' : 'secondary'}>
                            {row.published ? 'Published' : 'Draft'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          /blog/{row.slug}
                          {row.published_at ? ` · ${String(row.published_at).slice(0, 10)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {row.published && (
                          <Button asChild size="sm" variant="ghost">
                            <a href={`/blog/${row.slug}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteId(row.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{draft.id ? 'Edit post' : 'New blog post'}</DialogTitle>
              <DialogDescription>
                Use headings, images, and formatting in the editor. Toggle Publish when ready.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="blog-title">Heading / title</Label>
                <Input
                  id="blog-title"
                  value={draft.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Why teams outgrow spreadsheets"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="blog-slug">URL slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">/blog/</span>
                  <Input
                    id="blog-slug"
                    value={draft.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setDraft((d) => ({ ...d, slug: e.target.value }));
                    }}
                    placeholder="why-teams-outgrow-spreadsheets"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="blog-desc">Short description</Label>
                <Textarea
                  id="blog-desc"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="blog-author">Author name</Label>
                  <Input
                    id="blog-author"
                    value={draft.author_name}
                    onChange={(e) => setDraft((d) => ({ ...d, author_name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="blog-author-title">Author title</Label>
                  <Input
                    id="blog-author-title"
                    value={draft.author_title}
                    onChange={(e) => setDraft((d) => ({ ...d, author_title: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="blog-tags">Tags (comma-separated)</Label>
                <Input
                  id="blog-tags"
                  value={draft.tags}
                  onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                  placeholder="forms, workflows, governance"
                />
              </div>
              <div className="grid gap-2">
                <Label>Cover image</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={draft.cover_image_url}
                    onChange={(e) => setDraft((d) => ({ ...d, cover_image_url: e.target.value }))}
                    placeholder="https://… or upload"
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onCoverPick(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
                  </Button>
                </div>
                {draft.cover_image_url && (
                  <img
                    src={draft.cover_image_url}
                    alt=""
                    className="mt-2 max-h-40 rounded-md border object-cover"
                  />
                )}
              </div>
              <div className="grid gap-2">
                <Label>Content</Label>
                <div className="rounded-md border bg-background">
                  <TiptapEditor
                    content={draft.content_html}
                    onChange={(html) => setDraft((d) => ({ ...d, content_html: html }))}
                    placeholder="Write the article… use headings, lists, and images from the toolbar."
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Publish on /blog</p>
                  <p className="text-xs text-muted-foreground">Off = draft (admins only)</p>
                </div>
                <Switch
                  checked={draft.published}
                  onCheckedChange={(published) => setDraft((d) => ({ ...d, published }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Import posts (JSON)</DialogTitle>
              <DialogDescription>
                Paste a JSON object or array with fields: title, slug, description, content_html (or body[]),
                author_name, tags, published, cover_image_url.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              rows={12}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='[{"title":"My post","slug":"my-post","content_html":"<p>Hello</p>","published":true}]'
              className="font-mono text-xs"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button onClick={() => void runImport()} disabled={createPost.isPending || !importText.trim()}>
                Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(deleteId)} onOpenChange={(v) => !v && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this post?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes it from /blog permanently. Static seed posts are unaffected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteId) void deletePost.mutateAsync(deleteId);
                  setDeleteId(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageContent>
  );
}
