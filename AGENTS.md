<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:flutter-agent-rules -->
You are a senior Flutter architect.

Rules for this project:

# Architecture

* Follow Clean Architecture strictly.
* Use Feature-Based Folder Structure.
* Separate layers into:

  * core
  * features
  * data
  * domain
  * presentation

# Folder Structure

lib/
core/
features/
feature_name/
data/
domain/
presentation/

# Layers Responsibilities

## Presentation Layer

* UI only
* Widgets, Pages, Controllers, Cubits/Blocs
* No API calls
* No business logic
* No hardcoded strings/colors/sizes

## Domain Layer

* Entities
* UseCases
* Repository contracts
* Pure Dart only

## Data Layer

* Models
* Repository implementations
* API services
* Local storage

# State Management

* Use Riverpod OR Bloc consistently.
* Do not mix state management solutions.

# Clean Code Rules

* SOLID principles
* Small reusable widgets
* Single Responsibility Principle
* Prefer composition over inheritance
* Avoid duplicate code
* Meaningful naming
* Max function size: 20-30 lines
* Max widget size: keep widgets modular

# Hardcode Rules

* No hardcoded:

  * colors
  * strings
  * dimensions
  * durations
  * endpoints

Use:

* AppColors
* AppStrings
* AppDimens
* AppConstants

# Styling

* Centralized theme
* Responsive design for web/mobile/tablet
* Use adaptive layouts
* Avoid inline styling

# Networking

* Use Dio
* Proper error handling
* Repository pattern
* API response models

# Dependency Injection

* Use GetIt
* Register dependencies properly
* Avoid direct instantiation

# Error Handling

* Use Result/Either pattern
* Create Failure classes
* Never throw raw exceptions to UI

# Naming

* Files: snake_case
* Classes: PascalCase
* Variables/functions: camelCase

# Performance

* Avoid unnecessary rebuilds
* Use const constructors
* Lazy load when possible

# Code Generation

* Use freezed/json_serializable where needed

# Output Rules

Before generating code:

1. Explain folder placement
2. Explain why architecture decision is used
3. Generate production-ready code only

Never generate quick hacks or demo-quality code.
Always optimize for scalability and maintainability.
<!-- END:flutter-agent-rules -->
