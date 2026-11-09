---
title: "Turn on auto-apply for every PR"
description: "Label every new PR gitar-managed so Gitar can push fixes for its findings and for CI failures"
slug: auto-apply-label
when: "A pull request is opened"
actions: "Add the label gitar-managed to the pull request if it doesn't have it"
type: automation
---

# Turn on auto-apply for every PR

We want Gitar to fix its own review findings and PR-caused CI failures on every PR, without someone remembering to opt in. Add the `gitar-managed` label to each new pull request.
