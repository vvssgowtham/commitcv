# Design references

Read the matching file before writing UI for a surface. Generated with `npx getdesign@latest add <name>`.

| Surface | Reference |
|---|---|
| Landing page | [jobright.md](jobright.md) |
| Dashboard | [linear.md](linear.md) — structure only, light palette (`ln-` tokens in `globals.css`) |
| Resume editor | [notion.md](notion.md) |
| GitHub projects | [vercel.md](vercel.md) |
| Job analysis | [jobright.md](jobright.md) + [linear.md](linear.md) |
| Generated resume | Clean document-editor style: single column, black on white, no color, ATS-safe |

The whole product is light. `linear.md` describes a dark marketing site, so we take its structure (density, hairlines, surface ladder, 8px buttons, lavender as the single action colour) and apply it on a light palette to stay consistent with the Notion, Vercel and document surfaces.
