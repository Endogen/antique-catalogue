# Frontend (Next.js)

## Overview

Modern, responsive web UI built with Next.js App Router, shadcn/ui, and Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod
- **Auth**: JWT in httpOnly cookies
- **Image Handling**: next/image + client-side cropper

## Pages Structure

```
app/
├── (auth)/
│   ├── login/
│   ├── register/
│   ├── verify/
│   ├── forgot-password/
│   └── reset-password/
├── (dashboard)/
│   ├── layout.tsx          # Sidebar + header
│   ├── page.tsx            # Dashboard home
│   ├── collections/
│   │   ├── page.tsx        # List collections
│   │   ├── new/            # Create collection
│   │   └── [id]/
│   │       ├── page.tsx    # View/edit collection
│   │       ├── items/
│   │       │   ├── page.tsx    # List items
│   │       │   ├── new/        # Create item
│   │       │   └── [itemId]/   # View/edit item
│   │       └── settings/   # Collection settings
│   ├── mobile/             # Mobile device management
│   └── settings/           # User settings
└── api/                    # API routes (if needed)
```

## Layout

### Sidebar Navigation
```
┌─────────────────────────────────────────────┐
│ [Logo] Antique Catalogue                    │
├─────────────────────────────────────────────┤
│                                             │
│ Dashboard                                   │
│                                             │
│ Collections                                 │
│   ├── Victorian Furniture (24)              │
│   ├── Art Deco Jewelry (156)                │
│   └── + New Collection                      │
│                                             │
│ Mobile Devices                              │
│                                             │
│ Settings                                    │
│                                             │
├─────────────────────────────────────────────┤
│ [Avatar] user@example.com                   │
│          Logout                             │
└─────────────────────────────────────────────┘
```

### Header
- Breadcrumbs
- Search (global)
- Notifications (future)
- User menu

## Key Components

### 1. Collection Card
```tsx
<CollectionCard>
  <CardImage src={primaryItemImage} />
  <CardTitle>Victorian Furniture</CardTitle>
  <CardDescription>24 items</CardDescription>
  <CardFooter>
    <Button>View</Button>
    <DropdownMenu>Edit | Delete</DropdownMenu>
  </CardFooter>
</CollectionCard>
```

### 2. Item Grid
```tsx
<ItemGrid>
  {items.map(item => (
    <ItemCard key={item.id}>
      <ItemImage src={item.thumbnailUrl} />
      <ItemName>{item.name}</ItemName>
      <ItemMeta>{item.metadata.Condition}</ItemMeta>
    </ItemCard>
  ))}
</ItemGrid>
```

### 3. Dynamic Form Builder
Generates form fields based on collection schema:

```tsx
<DynamicForm schema={collection.fieldDefinitions}>
  {/* Automatically renders: */}
  <TextField name="Purchase Location" />
  <NumberField name="Purchase Price" min={0} decimals={2} />
  <DatePicker name="Purchase Date" />
  <Select name="Condition" options={conditionOptions} />
  <MultiSelect name="Materials" options={materialOptions} />
  <Checkbox name="Authenticated" />
</DynamicForm>
```

### 4. Image Uploader
```tsx
<ImageUploader
  onUpload={handleUpload}
  maxFiles={20}
  maxSize="20MB"
  accept={["image/jpeg", "image/png", "image/webp"]}
>
  <DropZone>
    Drag & drop images here, or click to browse
  </DropZone>
  <ImagePreviews>
    {images.map(img => (
      <ImagePreview key={img.id}>
        <img src={img.thumbnailUrl} />
        <EditButton onClick={() => openEditor(img)} />
        <DeleteButton onClick={() => deleteImage(img.id)} />
      </ImagePreview>
    ))}
  </ImagePreviews>
</ImageUploader>
```

### 5. Image Editor Modal
```tsx
<ImageEditorModal>
  <Cropper
    src={image.url}
    aspect={freeform}
    onCrop={setCropArea}
  />
  <Toolbar>
    <RotateLeftButton />
    <RotateRightButton />
    <ResetButton />
  </Toolbar>
  <Actions>
    <CancelButton />
    <SaveButton onClick={handleSave} />
  </Actions>
</ImageEditorModal>
```

### 6. Mobile Pairing
```tsx
<PairingDialog>
  <QRCode data={pairingData.qr_data} size={200} />
  <Separator>or enter code manually</Separator>
  <PairingCode>{pairingData.pairing_code}</PairingCode>
  <Timer expiresAt={pairingData.expires_at} />
</PairingDialog>
```

## Data Fetching

Using React Query:

```tsx
// Hooks
const { data: collections } = useCollections()
const { data: items } = useItems(collectionId, { search, filters })
const { mutate: createItem } = useCreateItem()
const { mutate: uploadImage } = useUploadImage()

// Optimistic updates
const { mutate: updateItem } = useUpdateItem({
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['item', id])
    const previous = queryClient.getQueryData(['item', id])
    queryClient.setQueryData(['item', id], newData)
    return { previous }
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['item', id], context.previous)
  },
})
```

## Forms with Validation

```tsx
const schema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.any()), // Validated server-side
  notes: z.string().optional(),
})

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: item,
})
```

## Responsive Design

| Breakpoint | Layout |
|------------|--------|
| < 640px (mobile) | Single column, bottom nav |
| 640-1024px (tablet) | Collapsed sidebar, 2-col grid |
| > 1024px (desktop) | Full sidebar, 3-4 col grid |

## Dark Mode

- System preference detection
- Manual toggle in settings
- Tailwind dark: classes
- Stored in localStorage

## Loading States

- Skeleton loaders for lists/grids
- Spinner for actions
- Progress bar for uploads
- Optimistic updates where safe

## Error Handling

- Toast notifications for errors
- Form field validation errors
- Full-page error for critical failures
- Retry buttons for failed requests

## Accessibility

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus management
- Screen reader support
- Sufficient color contrast

## Performance

- Image lazy loading
- Virtual scrolling for large lists
- Code splitting per route
- Prefetching on hover
- Service worker for caching (optional)
