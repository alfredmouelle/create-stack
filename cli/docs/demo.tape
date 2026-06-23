# create-stack demo — record with: vhs demo.tape  (run from cli/docs/)
# Needs `create-stack` on PATH:  pnpm add -g @alfredmouelle/create-stack
# vhs: https://github.com/charmbracelet/vhs

Output demo.gif

Set Shell bash
Set FontSize 18
Set Width 1100
Set Height 720
Set Padding 24
Set TypingSpeed 55ms
Set Theme "Catppuccin Mocha"

# start in a throwaway dir, off-camera
Hide
Type "cd $(mktemp -d) && clear" Enter
Show

# 1. scaffold a project (with a redis cache)
Type "create-stack my-app --framework next --foundations drizzle,trpc --cache redis --no-install"
Sleep 600ms
Enter
Sleep 3s

# 2. swap the cache adapter behind the same port — one command
Type "cd my-app && create-stack add cache upstash --no-install"
Sleep 600ms
Enter
Sleep 3s

Type "#  redis → upstash — swapped, deps + env updated, zero refactor"
Sleep 2500ms
