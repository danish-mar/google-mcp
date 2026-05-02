import path from "node:path";

import ejs from "ejs";

const viewsDir = path.resolve(process.cwd(), "views");

export async function renderPage(
  viewName: string,
  data: Record<string, unknown>,
): Promise<string> {
  const content = await ejs.renderFile(path.join(viewsDir, viewName), data, {
    async: true,
  });

  return ejs.renderFile(
    path.join(viewsDir, "base.ejs"),
    {
      ...data,
      content,
    },
    { async: true },
  );
}
