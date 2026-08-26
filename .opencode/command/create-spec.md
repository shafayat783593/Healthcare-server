---
description: Create a spec file and feature branch for the next expense-tracker step feather

argument-hint: "Step number and feature name e.g. 2 registration"
allowed-tools: Read, Write, Glob, Bash(git:*)
---


You are a senior developer spinning up a new feature for the
expense tracker. Always follow the rules in AGENT.md .

User input: $ARGUMENTS



## Step 1 — Parse the arguments
From $ARGUMENTS extract:
1. `step_number` — zero-padded to 2 digits: 2 → 02, 11 → 11
2. `feature_title` — human readable title in Title Case
   - Example: "Registration" or "Login and Logout"
3. `feature_slug` — git and file safe slug
   - Lowercase, kebab-case
   - Only a-z, 0-9 and -
   - Maximum 40 characters
   - Example: registration, login-logout

4. `branch_name` — format: `feature/<feature_slug>`
   - Example: `feature/registration`

If you cannot infer these from $ARGUMENTS, ask the user
to clarify before proceeding.

## Step 2 — Research the codebase
Read these files before writing the spec:
- `AGENT.md` — roadmap, conventions, schema
- `@frontend` — existing routes and structure
- All files in `.opencode/specs/` — avoid duplicating existing specs

Check `AGENT.md` to confirm the requested step is not already
marked complete. If it is, warn the user and stop.



## Step 3 — Write the spec
Generate a spec document with this exact structure:


# Spec: <feature_title>

## Overview
One paragraph describing what this feature does and why
it exists at this stage of the expanse-tracker roadmap.


## Depends on
Which previous steps this feature requires to be complete.

## Routes
Every new route needed:
- `METHOD /path` — description — access level (public/logged-in)

If no new routes: state "No new routes".

## Templates
- **Create:** list new templates with their path
- **Modify:** list existing templates and what changes


## Files to change
Every file that will be modified.

## Files to create
Every new file that will be created.

## New dependencies
Any new npm packages. If none: state "No new dependencies".

## Rules for implementation
Specific constraints  must follow. Always include:
- if and feature need api implementation add you can add.
- All templates make ShadcnUi

## Definition of done
A specific testable checklist. Each item must be
something that can be verified by running the app.
---
## Step 4 — Save the spec
Save to: `..opencode/specs/<step_number>-<feature_slug>.md`

## Step 9 — Report to the user
Print a short summary in this exact format:
```
Branch:    <branch_name>
Spec file: .opencode/specs/<step_number>-<feature_slug>.md
Title:     <feature_title>
```


Then tell the user:
"Review the spec at `.opencode/specs/<step_number>-<feature_slug>.md`
then enter Plan Mode with Shift+Tab twice to begin implementation."

Do not print the full spec in chat unless explicitly asked.