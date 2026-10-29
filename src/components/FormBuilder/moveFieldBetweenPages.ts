/**
 * Page membership for the form builder.
 * A field is on a page when its pageId matches, its id is listed in page.fields,
 * or the page is the default page and the field has no pageId.
 */

export const PAGE_TARGET_DROPPABLE_PREFIX = 'page-target:';

export function pageTargetDroppableId(pageId: string): string {
  return `${PAGE_TARGET_DROPPABLE_PREFIX}${pageId}`;
}

export function destinationPageIdFromDroppable(droppableId: string | null | undefined): string | null {
  if (!droppableId || !droppableId.startsWith(PAGE_TARGET_DROPPABLE_PREFIX)) return null;
  const pageId = droppableId.slice(PAGE_TARGET_DROPPABLE_PREFIX.length);
  return pageId.length > 0 ? pageId : null;
}

export interface FieldPageMembership {
  id: string;
  pageId?: string;
}

export interface PageFieldMembership {
  id: string;
  fields: string[];
}

export function orderedFieldsForPage<T extends FieldPageMembership>(
  fields: T[],
  page: PageFieldMembership | null | undefined,
): T[] {
  if (!page) return [];
  const pageFieldOrder = page.fields || [];
  const pageFields = fields.filter((field) => {
    if (field.pageId === page.id) return true;
    if (pageFieldOrder.includes(field.id)) return true;
    if (page.id === 'default' && !field.pageId) return true;
    return false;
  });

  return [...pageFields].sort((a, b) => {
    const aIndex = pageFieldOrder.indexOf(a.id);
    const bIndex = pageFieldOrder.indexOf(b.id);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return 0;
  });
}

export function moveFieldBetweenPages<
  TField extends FieldPageMembership,
  TPage extends PageFieldMembership,
  TForm extends { fields: TField[]; pages: TPage[] },
>(
  form: TForm,
  sourcePageId: string,
  sourceIndex: number,
  destinationPageId: string,
): { form: TForm; movedFieldId: string } | null {
  if (!sourcePageId || !destinationPageId || sourcePageId === destinationPageId) return null;

  const sourcePage = form.pages.find((page) => page.id === sourcePageId);
  const destinationPage = form.pages.find((page) => page.id === destinationPageId);
  if (!sourcePage || !destinationPage) return null;

  const visibleFields = orderedFieldsForPage(form.fields, sourcePage);
  const moved = visibleFields[sourceIndex];
  if (!moved) return null;

  const pages = form.pages.map((page) => {
    const withoutMoved = (page.fields || []).filter((fieldId) => fieldId !== moved.id);
    if (page.id !== destinationPageId) {
      return { ...page, fields: withoutMoved };
    }
    return { ...page, fields: [...withoutMoved, moved.id] };
  }) as TPage[];

  const fields = form.fields.map((field) =>
    field.id === moved.id ? { ...field, pageId: destinationPageId } : field,
  );

  return {
    form: { ...form, fields, pages },
    movedFieldId: moved.id,
  };
}
