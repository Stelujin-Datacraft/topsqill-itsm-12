import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { buildSolutionObjects, type SolutionExportRows } from './solution-export';
import {
  KNOWN_MODULES,
  PACKAGE_KEY_PATTERN,
  PACKAGE_LICENSES,
  buildPackage,
  isValidVersion,
  type PackageFile,
  type PackageLicense,
  type Signer,
} from './spec';

export interface ExportRequest {
  solutionId: string;
  key: string;
  name: string;
  version: string;
  description?: string;
  license?: PackageLicense;
  requiresModules?: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHUNK = 100;

export function parseExportRequest(body: Record<string, unknown>): ExportRequest {
  const solutionId = String(body.solutionId || '');
  if (!UUID.test(solutionId)) throw new BadRequestException('solutionId must be a UUID');
  const key = String(body.key || '').trim();
  if (!PACKAGE_KEY_PATTERN.test(key)) throw new BadRequestException('Package key must be lowercase letters, numbers and dashes, starting with a letter');
  const name = String(body.name || '').trim();
  if (!name) throw new BadRequestException('Package name is required');
  const version = String(body.version || '').trim();
  if (!isValidVersion(version)) throw new BadRequestException('Version must look like 1.0.0');
  const license = String(body.license || 'private') as PackageLicense;
  if (!(PACKAGE_LICENSES as readonly string[]).includes(license)) throw new BadRequestException(`License must be one of ${PACKAGE_LICENSES.join(', ')}`);
  const requiresModules = Array.isArray(body.requiresModules) ? body.requiresModules.map(String) : [];
  for (const module of requiresModules) {
    if (!(KNOWN_MODULES as readonly string[]).includes(module)) throw new BadRequestException(`Unknown module "${module}"`);
  }
  return {
    solutionId,
    key,
    name,
    version,
    description: typeof body.description === 'string' ? body.description.trim() : '',
    license,
    requiresModules: Array.from(new Set(requiresModules)),
  };
}

/** PACKAGE_SIGNING_PRIVATE_KEY may be stored with literal \n sequences in .env files. */
export function signerFromEnv(env: NodeJS.ProcessEnv = process.env): Signer | null {
  const keyId = env.PACKAGE_SIGNING_KEY_ID?.trim();
  const privateKeyPem = env.PACKAGE_SIGNING_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  return keyId && privateKeyPem ? { keyId, privateKeyPem } : null;
}

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  private async selectIn(client: SupabaseClient, table: string, column: string, values: string[], columns = '*') {
    const rows: any[] = [];
    for (let i = 0; i < values.length; i += CHUNK) {
      const { data, error } = await client.from(table).select(columns).in(column, values.slice(i, i + CHUNK));
      if (error) throw new BadRequestException(`Could not read ${table}: ${error.message}`);
      rows.push(...(data || []));
    }
    return rows;
  }

  private async selectEq(client: SupabaseClient, table: string, column: string, value: string) {
    const { data, error } = await client.from(table).select('*').eq(column, value);
    if (error) throw new BadRequestException(`Could not read ${table}: ${error.message}`);
    return data || [];
  }

  /** Reads with the caller's own token, so row-level security decides what can be exported. */
  async exportSolution(authHeader: string, userId: string, request: ExportRequest): Promise<{ pkg: PackageFile; summary: Record<string, number> }> {
    const client = this.supabase.getClientForUser(authHeader);

    const { data: solution, error: solutionError } = await client.from('solutions').select('*').eq('id', request.solutionId).maybeSingle();
    if (solutionError) throw new BadRequestException(solutionError.message);
    if (!solution) throw new NotFoundException('Solution not found');

    const { data: isAdmin, error: adminError } = await client.rpc('is_org_admin_of', { _org_id: solution.organization_id });
    if (adminError) throw new BadRequestException(adminError.message);
    if (!isAdmin) throw new ForbiddenException('Only organisation administrators can export packages');

    const links = await this.selectEq(client, 'solution_forms', 'solution_id', solution.id);
    const formIds: string[] = links.map((link: any) => link.form_id);
    if (!formIds.length) throw new BadRequestException('Add at least one form to the solution before exporting it');

    const [forms, fields, workflows, triggers, reports] = await Promise.all([
      this.selectIn(client, 'forms', 'id', formIds),
      this.selectIn(client, 'form_fields', 'form_id', formIds),
      this.selectEq(client, 'workflows', 'project_id', solution.project_id),
      this.selectIn(client, 'workflow_triggers', 'source_form_id', formIds),
      this.selectEq(client, 'reports', 'project_id', solution.project_id),
    ]);
    const workflowIds = workflows.map((w: any) => w.id);
    const reportIds = reports.map((r: any) => r.id);
    const [nodes, connections, components] = await Promise.all([
      this.selectIn(client, 'workflow_nodes', 'workflow_id', workflowIds),
      this.selectIn(client, 'workflow_connections', 'workflow_id', workflowIds),
      this.selectIn(client, 'report_components', 'report_id', reportIds),
    ]);

    const rows: SolutionExportRows = { solution, formIds, forms, fields, workflows, nodes, connections, triggers, reports, components };
    const { objects, summary } = buildSolutionObjects(rows);

    const { data: org } = await client.from('organizations').select('name').eq('id', solution.organization_id).maybeSingle();
    const signer = signerFromEnv();
    const pkg = buildPackage(
      {
        key: request.key,
        name: request.name,
        version: request.version,
        publisher: process.env.PACKAGE_PUBLISHER?.trim() || org?.name || 'Topsqill',
        description: request.description || '',
        license: request.license || 'private',
        requires: { modules: request.requiresModules || [] },
        createdAt: new Date().toISOString(),
      },
      objects,
      signer,
    );

    await this.audit({
      organizationId: solution.organization_id,
      projectId: solution.project_id,
      actorId: userId,
      action: 'export',
      pkg,
      detail: { solutionId: solution.id, solutionName: solution.name, signed: !!signer, ...summary },
    });

    return { pkg, summary: { ...summary, signed: signer ? 1 : 0 } };
  }

  async audit(entry: {
    organizationId: string;
    projectId: string | null;
    actorId: string;
    action: string;
    pkg: PackageFile;
    detail: Record<string, unknown>;
  }) {
    const { error } = await this.supabase
      .getServiceClient()
      .from('package_audit_log')
      .insert({
        organization_id: entry.organizationId,
        project_id: entry.projectId,
        actor_id: entry.actorId,
        action: entry.action,
        package_key: entry.pkg.manifest.key,
        package_version: entry.pkg.manifest.version,
        checksum: entry.pkg.integrity.checksum,
        detail: entry.detail,
      });
    if (error) this.logger.warn(`Package audit write failed (${entry.action} ${entry.pkg.manifest.key}): ${error.message}`);
  }
}
