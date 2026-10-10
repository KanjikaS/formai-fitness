<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep FormAI's shared shell and session-only demo state in `src/components/formai`; the root provider lets activity logs stay consistent across pages without storing sensitive profile data.
- Use separate TanStack leaf routes for every wellness area and profile flow so navigation and page metadata remain independent.
- Never call real analysis services in this UI prototype; label recording, calorie estimation, personalization, and pose detection previews explicitly.
