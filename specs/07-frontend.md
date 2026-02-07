# Frontend

## Tech Stack
- Next.js 14+ (App Router)
- shadcn/ui components
- Tailwind CSS
- React Query (TanStack Query)
- React Hook Form + Zod

## Pages

### Public (no auth)
- `/` - Landing page
- `/login` - Login form
- `/register` - Registration form
- `/verify` - Email verification
- `/forgot-password` - Request reset
- `/reset-password` - Set new password
- `/explore` - Public collections directory
- `/explore/{id}` - View public collection

### Protected (auth required)
- `/dashboard` - User's collections list
- `/collections/new` - Create collection
- `/collections/{id}` - Collection detail (items list)
- `/collections/{id}/settings` - Collection settings + schema builder
- `/collections/{id}/items/new` - Create item
- `/collections/{id}/items/{id}` - Item detail
- `/collections/{id}/items/{id}/edit` - Edit item
- `/settings` - User settings

## Responsive Design
- Mobile-first approach
- Touch-friendly controls
- Works well on Android phones
- Camera capture button for image upload

## Key Components
- Schema builder (drag-drop field reorder)
- Dynamic form generator (from schema)
- Image uploader (drag-drop + camera capture)
- Search/filter/sort controls
- Pagination
