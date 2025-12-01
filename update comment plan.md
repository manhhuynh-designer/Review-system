🤖 TECHNICAL SPECIFICATION: ADVANCED COMMENT & ANNOTATION SYSTEM

Context: React + TypeScript + Vite + Firebase v9 + Zustand + Tailwind CSS.
Goal: Upgrade the existing comment system to support Pinning, Filtering, Auto-linking, Reactions, and Image/Video Annotation.

1. TYPE DEFINITIONS & SCHEMA (src/types/index.ts)

Instruction: Extend the existing Comment interface and add new supporting types.

// New Interface for Annotation Data
export interface AnnotationObject {
  id: string;
  type: 'pen' | 'rect' | 'arrow';
  color: string;
  strokeWidth: number;
  // Normalized coordinates (0 to 1) relative to container width/height
  points?: number[]; // For 'pen' (flat array: [x1, y1, x2, y2, ...])
  x?: number;        // For 'rect'
  y?: number;        // For 'rect'
  w?: number;        // For 'rect'
  h?: number;        // For 'rect'
  startPoint?: { x: number, y: number }; // For 'arrow'
  endPoint?: { x: number, y: number };   // For 'arrow'
}

// Updated Comment Interface
export interface Comment {
  id: string;
  projectId: string;
  fileId: string;
  version: number;
  userName: string;
  content: string;
  timestamp: number | null; // Video seek time
  parentCommentId: string | null;
  isResolved: boolean;
  createdAt: any; // Firestore Timestamp
  
  // --- NEW FIELDS ---
  isPinned?: boolean; // Default false
  reactions?: Record<string, string>; // Map: { "userId": "👍" } for O(1) lookup
  annotationData?: string | null; // JSON.stringify(AnnotationObject[])
}


2. ZUSTAND STORE LOGIC (src/stores/useCommentStore.ts)

Instruction: Refactor useCommentStore to handle the new fields.

2.1. Actions to Implement

addComment:

Signature: (..., annotationData?: string) => Promise<void>

Logic: Pass annotationData to Firestore addDoc.

togglePin:

Signature: (projectId: string, commentId: string, currentStatus: boolean) => Promise<void>

Logic: updateDoc setting isPinned: !currentStatus.

toggleReaction:

Signature: (projectId: string, commentId: string, userId: string, emoji: string) => Promise<void>

Logic:

Read current document reactions field.

If reactions[userId] === emoji -> delete key (toggle off).

Else -> set reactions[userId] = emoji (update/add).

Use updateDoc with the modified map.

2.2. Query Strategy (subscribeToComments)

Query: collection(..., 'comments')

Sorting:

orderBy('isPinned', 'desc') (Pinned items (true) come first)

orderBy('createdAt', 'desc') (Newest first)

Note: Ensure a Firestore composite index exists for this query.

3. COMPONENT IMPLEMENTATION SPECS

3.1. AnnotationCanvas.tsx (New Component)

Role: Transparent overlay for drawing and rendering annotations.

Props:

mode: 'read' | 'edit'

data: AnnotationObject[] (for read mode)

tool: 'pen' | 'rect' | 'arrow' (for edit mode)

color: string

onChange: (data: AnnotationObject[]) => void

Tech: Use HTML5 <canvas> API.

Coordinate System (CRITICAL):

Input: Mouse events (nativeEvent.offsetX, nativeEvent.offsetY).

Normalization:

savedX = offsetX / canvasWidth

savedY = offsetY / canvasHeight

Rendering:

drawX = savedX * currentCanvasWidth

drawY = savedY * currentCanvasHeight

Why? Ensures drawings stay correct when the window/player resizes.

Drawing Logic:

Use requestAnimationFrame for smooth drawing loop.

On mousedown: Start new shape.

On mousemove: Update current shape geometry.

On mouseup: Finalize shape, append to state, call onChange.

3.2. CommentsList.tsx (Refactor)

Auto-Link Logic:

Create utility: linkify(text: string): ReactNode.

Regex: /((https?:\/\/|www\.)[^\s]+)/g.

Replace matches with <a href="..." target="_blank" class="text-blue-400 hover:underline">.

Layout Changes:

Pinning: If comment.isPinned, render a specific icon/badge and background highlight (e.g., bg-yellow-500/10).

Reactions: Render a flex row of emojis below content. Click triggering toggleReaction.

Annotation Trigger: If comment.annotationData exists, show a "View Annotation" button. Clicking it invokes a callback onViewAnnotation(data) prop.

3.3. CommentFilter.tsx (New Component)

Props: onFilterChange: (filters: FilterState) => void, uniqueAuthors: string[].

UI:

Dropdown for Status: All, Resolved, Unresolved.

Dropdown for Author: List of userNames.

4. INTEGRATION GUIDE

4.1. ImageViewer.tsx & VideoPlayer.tsx

Instruction: Wrap the media element and the canvas in a relative container.

<div className="relative w-full h-full flex justify-center items-center bg-black">
  {/* Media Layer */}
  <img src={url} className="max-h-full max-w-full object-contain" />
  
  {/* Annotation Layer - Absolute Position matches Media */}
  <div className="absolute inset-0 pointer-events-none"> 
     {/* Logic to match Canvas size to Image/Video actual rendered size */}
     <AnnotationCanvas 
        mode={isCommenting ? 'edit' : 'read'} 
        /* ... props */ 
     />
  </div>
</div>


5. EXECUTION PLAN

Step 1: Update types/index.ts first.

Step 2: Create AnnotationCanvas.tsx (Pure logic component).

Step 3: Update useCommentStore.ts with new actions.

Step 4: Create CommentFilter.tsx and ReactionPicker.tsx.

Step 5: Refactor CommentsList.tsx to integrate all features.

Step 6: Update Parent Viewers to host the AnnotationCanvas.

Generate code following this exact order to avoid dependency errors.