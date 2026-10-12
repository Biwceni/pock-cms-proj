type AdminRouteParams = Record<string, string | string[] | undefined> | undefined;

export function getPuckEditorRouteParams(params: AdminRouteParams) {
  const segments = params?.segments;
  if (
    !Array.isArray(segments) ||
    segments.length !== 3 ||
    segments[0] !== 'puck-editor' ||
    !segments[1] ||
    !segments[2]
  ) {
    return null;
  }

  return {
    collection: segments[1],
    id: segments[2],
  };
}
