function resolvePath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    const idx = /^\d+$/.test(key) ? Number(key) : key;
    return (acc as any)[idx];
  }, obj);
}

export interface HydrateContentOptions {
  root?: ParentNode;
  attribute?: string;
}

/**
 * Walks the DOM looking for elements marked with `data-content="path.to.value"`,
 * resolves the path against the remote content object, and applies the value:
 *   - `<img>` → src
 *   - `<a>`   → href
 *   - any other element → textContent
 *
 * Elements with `data-content-attr="..."` override the target attribute (eg.
 * `data-content-attr="alt"` on an <img>).
 *
 * Missing values are left untouched so the server-rendered shell stays valid.
 */
export function hydrateContent(remote: unknown, opts: HydrateContentOptions = {}): void {
  if (!remote || typeof remote !== "object") return;
  const root = opts.root ?? document;
  const attribute = opts.attribute ?? "data-content";

  const nodes = root.querySelectorAll<HTMLElement>(`[${attribute}]`);
  nodes.forEach((el) => {
    const path = el.getAttribute(attribute);
    if (!path) return;
    const value = resolvePath(remote, path);
    if (value == null) return;

    const explicitAttr = el.getAttribute("data-content-attr");
    if (explicitAttr) {
      el.setAttribute(explicitAttr, String(value));
      return;
    }

    if (el instanceof HTMLImageElement) {
      el.src = String(value);
      return;
    }
    if (el instanceof HTMLAnchorElement) {
      el.href = String(value);
      return;
    }

    el.textContent = String(value);
  });
}
