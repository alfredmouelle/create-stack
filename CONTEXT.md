# Create Stack

Create Stack generates a project from a chosen stack configuration. Its command-line language distinguishes how choices are collected from what kind of project is generated.

## Language

**Interactive creation**:
A project creation in which the CLI asks the user to choose the stack configuration.
_Avoid_: Wizard mode, prompt mode

**Non-interactive creation**:
A project creation that completes without asking questions. It begins when the user accepts the recommended stack or supplies any stack option.
_Avoid_: Automatic mode, CI mode

**Recommended stack**:
The opinionated stack configuration used when the user accepts every recommendation without supplying individual stack options.
_Avoid_: Default template, default foundation

**Applicable recommendations**:
The compatible recommendations used for stack parts that the user did not choose explicitly. They may vary with an explicit choice, such as the data layer, but never replace or contradict an explicit choice.
_Avoid_: Silent normalization, fallback configuration

**Minimal project**:
A frontend-only starting configuration without a backend, authentication, transactional email, or optional capabilities. Individual parts can subsequently be added to it.
_Avoid_: Vitrine, empty foundation, bare project

**Stack option**:
A user-facing choice that selects or removes one part of the generated stack, such as its database or authentication provider.
_Avoid_: Foundation

**Stack axis**:
An independently selectable concern in a stack configuration. tRPC is an API axis and does not intrinsically require a data or authentication axis.
_Avoid_: Foundation, preset field

**Choice conflict**:
Two explicit choices that cannot coexist or that select the same stack axis more than once. Conflicts are reported before project generation and are never resolved by precedence.
_Avoid_: Last option wins, normalization

**Operational option**:
A choice that changes how a project operation runs without changing the resulting stack, such as installation, package-manager selection, import aliasing, or Git initialization.
_Avoid_: Stack option, capability

**Recommended provider**:
The provider selected when a user requests a capability without naming its provider. Upstash is recommended for caching and R2 for storage.
_Avoid_: Implicit adapter, provider default

**Dependency completion**:
The addition of recommended supporting parts required by a selected stack option. It applies when those parts were merely absent from a starting configuration, but never overrides an explicit exclusion.
_Avoid_: Silent correction, fallback

**Explicit exclusion**:
A user choice that a particular part must not exist in the generated project. It takes precedence over recommendations and conflicts with any selected option that requires the excluded part.
_Avoid_: Empty choice, omitted option

**Addition**:
An enrichment applied to an existing application after its creation. Technical capabilities and interface components are both kinds of addition.
_Avoid_: Post-install, extension

**Capability**:
A technical addition that gives an application an infrastructure or service concern, such as caching, storage, logging, analytics, jobs, email, error tracking, or HTTP access.
_Avoid_: Foundation, plugin

**Component**:
A reusable interface element added to an existing application.
_Avoid_: Capability, widget

**Email UI**:
Reusable React Email primitives and theming added to an existing application, independently of the capability used to send email.
_Avoid_: Mailer

**HTTP capability**:
Typed HTTP client and server-response utilities added to an existing application.
_Avoid_: HTTP kit, API foundation

**Application target**:
The application within an existing project that receives additions. It is inferred when unique and otherwise identified by its path relative to the project root.
_Avoid_: Working directory, package target

**Addition batch**:
One or more additions requested together and validated in full before any project files are changed.
_Avoid_: Multi-select, bulk install

**Addition plan**:
A compact summary of the target, additions, and provider changes displayed immediately before a non-interactive addition is applied.
_Avoid_: Confirmation screen, dry run

**Provider change**:
The replacement of a capability's active provider by another provider. Files specific to the former provider are removed unless the user explicitly asks to retain them.
_Avoid_: Re-add, parallel adapter

**Project package manager**:
The package manager identified from the target project's lockfile and used when installing additions. A user may explicitly override that identification.
_Avoid_: Invoking package manager, CLI package manager
