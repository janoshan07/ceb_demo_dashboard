# Component Hierarchy and Organization

<cite>
**Referenced Files in This Document**
- [App.jsx](file://frontend/src/App.jsx)
- [main.jsx](file://frontend/src/main.jsx)
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [Admin.jsx](file://frontend/src/pages/Admin.jsx)
- [CustomerDetails.jsx](file://frontend/src/pages/CustomerDetails.jsx)
- [Login.jsx](file://frontend/src/pages/Login.jsx)
- [Reports.jsx](file://frontend/src/pages/Reports.jsx)
- [StagingReview.jsx](file://frontend/src/pages/StagingReview.jsx)
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [Sidebar.jsx](file://frontend/src/components/Sidebar.jsx)
- [SVGDonutChart.jsx](file://frontend/src/components/charts/SVGDonutChart.jsx)
- [SVGLineChart.jsx](file://frontend/src/components/charts/SVGLineChart.jsx)
- [SVGPredictionChart.jsx](file://frontend/src/components/charts/SVGPredictionChart.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [ToastContext.jsx](file://frontend/src/context/ToastContext.jsx)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document explains the React frontend component hierarchy and organization. It focuses on how pages, components, and utilities are separated, how composition patterns establish parent-child relationships, and how shared state is managed via context. The goal is to provide a clear mental model for navigating the codebase and maintaining clean boundaries between responsibilities.

## Project Structure
The React application follows a feature-oriented layout with clear separation:
- src/pages: Top-level route views that orchestrate data and compose UI from reusable components.
- src/components: Reusable UI building blocks (charts, layout helpers).
- src/context: Global state providers (authentication, toast notifications).
- Entry points: main.jsx bootstraps the app; App.jsx wires routing and providers.

```mermaid
graph TB
A["main.jsx"] --> B["App.jsx"]
B --> C["Pages<br/>src/pages/*"]
B --> D["Providers<br/>src/context/*"]
C --> E["Reusable Components<br/>src/components/*"]
E --> F["Charts<br/>src/components/charts/*"]
```

**Diagram sources**
- [main.jsx](file://frontend/src/main.jsx)
- [App.jsx](file://frontend/src/App.jsx)
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [Sidebar.jsx](file://frontend/src/components/Sidebar.jsx)
- [SVGDonutChart.jsx](file://frontend/src/components/charts/SVGDonutChart.jsx)

**Section sources**
- [main.jsx](file://frontend/src/main.jsx)
- [App.jsx](file://frontend/src/App.jsx)

## Core Components
- Pages
  - Dashboard: Orchestrates dashboard data and composes charts and panels.
  - Admin: Manages administrative tasks and user-related operations.
  - CustomerDetails: Displays detailed information about a selected customer.
  - Login: Handles authentication entry flow.
  - Reports: Renders report views and filters.
  - StagingReview: Reviews staged data before final import.
  - UploadPage: Guides file uploads and shows progress/validation feedback.
- Shared Components
  - Sidebar: Navigation shell used by authenticated layouts.
  - Charts: SVG-based chart primitives (donut, line, prediction) consumed by pages like Dashboard.
- Context Providers
  - AuthContext: Provides authentication state and actions across the app.
  - ToastContext: Provides global notification capabilities.

Key responsibilities:
- Pages own route-scoped state and coordinate child components.
- Components focus on presentation and small interactions.
- Context encapsulates cross-cutting concerns (auth, notifications).

**Section sources**
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [Admin.jsx](file://frontend/src/pages/Admin.jsx)
- [CustomerDetails.jsx](file://frontend/src/pages/CustomerDetails.jsx)
- [Login.jsx](file://frontend/src/pages/Login.jsx)
- [Reports.jsx](file://frontend/src/pages/Reports.jsx)
- [StagingReview.jsx](file://frontend/src/pages/StagingReview.jsx)
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [Sidebar.jsx](file://frontend/src/components/Sidebar.jsx)
- [SVGDonutChart.jsx](file://frontend/src/components/charts/SVGDonutChart.jsx)
- [SVGLineChart.jsx](file://frontend/src/components/charts/SVGLineChart.jsx)
- [SVGPredictionChart.jsx](file://frontend/src/components/charts/SVGPredictionChart.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [ToastContext.jsx](file://frontend/src/context/ToastContext.jsx)

## Architecture Overview
High-level runtime architecture:
- main.jsx renders the root provider tree.
- App.jsx configures routing and wraps routes with providers (e.g., auth, toast).
- Pages render based on current route and compose reusable components.
- Contexts supply shared state and actions globally.

```mermaid
graph TB
subgraph "Entry"
M["main.jsx"]
A["App.jsx"]
end
subgraph "Routing"
R1["Route: /dashboard -> Dashboard.jsx"]
R2["Route: /admin -> Admin.jsx"]
R3["Route: /login -> Login.jsx"]
R4["Route: /reports -> Reports.jsx"]
R5["Route: /staging-review -> StagingReview.jsx"]
R6["Route: /upload -> UploadPage.jsx"]
R7["Route: /customer/:id -> CustomerDetails.jsx"]
end
subgraph "Shared State"
AC["AuthContext.jsx"]
TC["ToastContext.jsx"]
end
subgraph "UI Building Blocks"
SB["Sidebar.jsx"]
CD["SVGDonutChart.jsx"]
CL["SVGLineChart.jsx"]
CP["SVGPredictionChart.jsx"]
end
M --> A
A --> AC
A --> TC
A --> R1
A --> R2
A --> R3
A --> R4
A --> R5
A --> R6
A --> R7
R1 --> SB
R1 --> CD
R1 --> CL
R1 --> CP
```

**Diagram sources**
- [main.jsx](file://frontend/src/main.jsx)
- [App.jsx](file://frontend/src/App.jsx)
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [Admin.jsx](file://frontend/src/pages/Admin.jsx)
- [Login.jsx](file://frontend/src/pages/Login.jsx)
- [Reports.jsx](file://frontend/src/pages/Reports.jsx)
- [StagingReview.jsx](file://frontend/src/pages/StagingReview.jsx)
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [CustomerDetails.jsx](file://frontend/src/pages/CustomerDetails.jsx)
- [Sidebar.jsx](file://frontend/src/components/Sidebar.jsx)
- [SVGDonutChart.jsx](file://frontend/src/components/charts/SVGDonutChart.jsx)
- [SVGLineChart.jsx](file://frontend/src/components/charts/SVGLineChart.jsx)
- [SVGPredictionChart.jsx](file://frontend/src/components/charts/SVGPredictionChart.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [ToastContext.jsx](file://frontend/src/context/ToastContext.jsx)

## Detailed Component Analysis

### Page Orchestration Pattern
Pages act as containers: they fetch or derive data, manage local UI state, and delegate rendering to presentational components. They consume contexts for auth and notifications.

```mermaid
sequenceDiagram
participant Router as "Router"
participant Page as "Page Component"
participant Auth as "AuthContext"
participant Toast as "ToastContext"
participant Child as "Child Component(s)"
Router->>Page : "Render page at route"
Page->>Auth : "Read auth state / actions"
Page->>Page : "Load data / set local state"
Page->>Toast : "Show status messages if needed"
Page->>Child : "Pass props (data, handlers)"
Child-->>Page : "Events (onClick, onChange)"
Page->>Page : "Update local state"
Page-->>Router : "Re-render with new props"
```

**Diagram sources**
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [ToastContext.jsx](file://frontend/src/context/ToastContext.jsx)
- [Sidebar.jsx](file://frontend/src/components/Sidebar.jsx)

**Section sources**
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [ToastContext.jsx](file://frontend/src/context/ToastContext.jsx)

### Chart Composition Pattern
Charts are reusable presentational components receiving typed data and configuration via props. Pages compose multiple charts to build dashboards.

```mermaid
classDiagram
class Dashboard {
+props : data, filters
+render()
}
class SVGDonutChart {
+props : data, labels, colors
+render()
}
class SVGLineChart {
+props : series, xLabels, yScale
+render()
}
class SVGPredictionChart {
+props : historical, forecast, confidence
+render()
}
Dashboard --> SVGDonutChart : "composes"
Dashboard --> SVGLineChart : "composes"
Dashboard --> SVGPredictionChart : "composes"
```

**Diagram sources**
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [SVGDonutChart.jsx](file://frontend/src/components/charts/SVGDonutChart.jsx)
- [SVGLineChart.jsx](file://frontend/src/components/charts/SVGLineChart.jsx)
- [SVGPredictionChart.jsx](file://frontend/src/components/charts/SVGPredictionChart.jsx)

**Section sources**
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [SVGDonutChart.jsx](file://frontend/src/components/charts/SVGDonutChart.jsx)
- [SVGLineChart.jsx](file://frontend/src/components/charts/SVGLineChart.jsx)
- [SVGPredictionChart.jsx](file://frontend/src/components/charts/SVGPredictionChart.jsx)

### Authentication Flow
Authentication state and actions are provided through context. Pages and components read/write this state to control navigation and behavior.

```mermaid
sequenceDiagram
participant User as "User"
participant Login as "Login.jsx"
participant Auth as "AuthContext.jsx"
participant Router as "Router"
participant Page as "Protected Page"
User->>Login : "Submit credentials"
Login->>Auth : "Dispatch login action"
Auth-->>Login : "Set isAuthenticated, user"
Login->>Router : "Navigate to protected route"
Router->>Page : "Render protected page"
Page->>Auth : "Read auth state"
Note over Page,Auth : "Protected content rendered"
```

**Diagram sources**
- [Login.jsx](file://frontend/src/pages/Login.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)

**Section sources**
- [Login.jsx](file://frontend/src/pages/Login.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)

### Upload and Review Workflow
UploadPage manages file selection, validation, and submission. StagingReview allows inspection and approval of staged records before committing.

```mermaid
flowchart TD
Start(["Start Upload"]) --> Select["Select File(s)"]
Select --> Validate["Validate Format & Headers"]
Validate --> Valid{"Valid?"}
Valid --> |No| ShowErrors["Show Validation Errors"]
Valid --> |Yes| Stage["Stage Records"]
Stage --> Review["Open StagingReview"]
Review --> Approve{"Approve?"}
Approve --> |Yes| Commit["Commit to Final Store"]
Approve --> |No| Edit["Edit / Reject Changes"]
Edit --> Review
Commit --> Done(["Done"])
ShowErrors --> End(["End"])
Done --> End
```

**Diagram sources**
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [StagingReview.jsx](file://frontend/src/pages/StagingReview.jsx)

**Section sources**
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [StagingReview.jsx](file://frontend/src/pages/StagingReview.jsx)

### Layout and Navigation
Sidebar provides navigation links and active state. Pages wrap their content within a layout that includes the sidebar when appropriate.

```mermaid
graph LR
Layout["Layout Shell"] --> Sidebar["Sidebar.jsx"]
Layout --> Content["Page Content"]
Sidebar --> NavLinks["Navigation Links"]
NavLinks --> Routes["Routes"]
```

**Diagram sources**
- [Sidebar.jsx](file://frontend/src/components/Sidebar.jsx)
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [Admin.jsx](file://frontend/src/pages/Admin.jsx)

**Section sources**
- [Sidebar.jsx](file://frontend/src/components/Sidebar.jsx)
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [Admin.jsx](file://frontend/src/pages/Admin.jsx)

## Dependency Analysis
- Entry and wiring
  - main.jsx initializes the React tree.
  - App.jsx sets up routing and providers.
- Provider dependencies
  - AuthContext supplies authentication state/actions.
  - ToastContext supplies notification functions.
- Page-to-component composition
  - Pages depend on reusable components (e.g., charts, sidebar).
- Cross-cutting concerns
  - Notifications and auth are accessed via context rather than prop drilling.

```mermaid
graph TB
M["main.jsx"] --> A["App.jsx"]
A --> AC["AuthContext.jsx"]
A --> TC["ToastContext.jsx"]
A --> P1["Dashboard.jsx"]
A --> P2["Admin.jsx"]
A --> P3["Login.jsx"]
A --> P4["Reports.jsx"]
A --> P5["StagingReview.jsx"]
A --> P6["UploadPage.jsx"]
A --> P7["CustomerDetails.jsx"]
P1 --> SB["Sidebar.jsx"]
P1 --> C1["SVGDonutChart.jsx"]
P1 --> C2["SVGLineChart.jsx"]
P1 --> C3["SVGPredictionChart.jsx"]
```

**Diagram sources**
- [main.jsx](file://frontend/src/main.jsx)
- [App.jsx](file://frontend/src/App.jsx)
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [Admin.jsx](file://frontend/src/pages/Admin.jsx)
- [Login.jsx](file://frontend/src/pages/Login.jsx)
- [Reports.jsx](file://frontend/src/pages/Reports.jsx)
- [StagingReview.jsx](file://frontend/src/pages/StagingReview.jsx)
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [CustomerDetails.jsx](file://frontend/src/pages/CustomerDetails.jsx)
- [Sidebar.jsx](file://frontend/src/components/Sidebar.jsx)
- [SVGDonutChart.jsx](file://frontend/src/components/charts/SVGDonutChart.jsx)
- [SVGLineChart.jsx](file://frontend/src/components/charts/SVGLineChart.jsx)
- [SVGPredictionChart.jsx](file://frontend/src/components/charts/SVGPredictionChart.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [ToastContext.jsx](file://frontend/src/context/ToastContext.jsx)

**Section sources**
- [main.jsx](file://frontend/src/main.jsx)
- [App.jsx](file://frontend/src/App.jsx)
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [ToastContext.jsx](file://frontend/src/context/ToastContext.jsx)

## Performance Considerations
- Memoization: Wrap expensive chart components with memoization to avoid unnecessary re-renders when props have not changed.
- Data locality: Keep heavy data transformations inside pages; pass derived, lightweight props to presentational components.
- Lazy loading: Consider lazy-loading heavy pages (e.g., reports, staging review) to reduce initial bundle size.
- Event coalescing: Debounce input-heavy events (search/filter) in pages to limit re-renders.
- Context usage: Consume only necessary fields from context to prevent broad re-renders.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Missing context values: Ensure providers are mounted above the consuming component tree. Verify that hooks are called within the correct provider scope.
- Unhandled errors in uploads: Surface validation errors via toast notifications and keep error state close to the upload page.
- Stale auth state: Refresh or revalidate auth state on protected routes; guard navigation using auth context.
- Chart rendering anomalies: Normalize data shapes before passing to chart components; ensure required props are present.

**Section sources**
- [AuthContext.jsx](file://frontend/src/context/AuthContext.jsx)
- [ToastContext.jsx](file://frontend/src/context/ToastContext.jsx)
- [UploadPage.jsx](file://frontend/src/pages/UploadPage.jsx)
- [StagingReview.jsx](file://frontend/src/pages/StagingReview.jsx)
- [Dashboard.jsx](file://frontend/src/pages/Dashboard.jsx)

## Conclusion
The application separates concerns cleanly: pages orchestrate data and composition, components encapsulate presentation, and contexts centralize cross-cutting state. This structure supports scalability, testability, and maintainability. Follow the composition patterns outlined here to keep boundaries clear and reuse effectively.