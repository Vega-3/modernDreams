# Graph Report - .  (2026-04-12)

## Corpus Check
- Corpus is ~42,725 words - fits in a single context window. You may not need a graph.

## Summary
- 409 nodes · 413 edges · 94 communities detected
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.85)
- Token cost: 1,520 input · 590 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dream Journal Features & Docs|Dream Journal Features & Docs]]
- [[_COMMUNITY_Graph Analysis Engine|Graph Analysis Engine]]
- [[_COMMUNITY_Tauri IPC Commands|Tauri IPC Commands]]
- [[_COMMUNITY_Python Backend Config|Python Backend Config]]
- [[_COMMUNITY_Data Models|Data Models]]
- [[_COMMUNITY_AI Claude Integration|AI Claude Integration]]
- [[_COMMUNITY_Graph Theory Concepts|Graph Theory Concepts]]
- [[_COMMUNITY_Handwriting Preview UI|Handwriting Preview UI]]
- [[_COMMUNITY_Jungian Archetypes Theory|Jungian Archetypes Theory]]
- [[_COMMUNITY_Graph Data Structures|Graph Data Structures]]
- [[_COMMUNITY_Graph View Controls|Graph View Controls]]
- [[_COMMUNITY_Rust Tag Commands|Rust Tag Commands]]
- [[_COMMUNITY_Dream CRUD Operations|Dream CRUD Operations]]
- [[_COMMUNITY_Handwriting Upload UI|Handwriting Upload UI]]
- [[_COMMUNITY_Obsidian Export|Obsidian Export]]
- [[_COMMUNITY_Theme Provider|Theme Provider]]
- [[_COMMUNITY_Dream Editor|Dream Editor]]
- [[_COMMUNITY_Utility Functions|Utility Functions]]
- [[_COMMUNITY_Settings Page|Settings Page]]
- [[_COMMUNITY_Archetype State Store|Archetype State Store]]
- [[_COMMUNITY_Tag Picker Component|Tag Picker Component]]
- [[_COMMUNITY_Professional Analyst Page|Professional Analyst Page]]
- [[_COMMUNITY_Tags Management Page|Tags Management Page]]
- [[_COMMUNITY_Analyst State Store|Analyst State Store]]
- [[_COMMUNITY_Database Connection|Database Connection]]
- [[_COMMUNITY_App Icon & Branding|App Icon & Branding]]
- [[_COMMUNITY_App Icon Assets|App Icon Assets]]
- [[_COMMUNITY_Search Dialog|Search Dialog]]
- [[_COMMUNITY_Dream Series Page|Dream Series Page]]
- [[_COMMUNITY_Dream Series Store|Dream Series Store]]
- [[_COMMUNITY_High-DPI Icon Assets|High-DPI Icon Assets]]
- [[_COMMUNITY_Calendar View|Calendar View]]
- [[_COMMUNITY_Dream Card Component|Dream Card Component]]
- [[_COMMUNITY_Tag Utility Functions|Tag Utility Functions]]
- [[_COMMUNITY_OCR Handwriting|OCR Handwriting]]
- [[_COMMUNITY_Search Commands|Search Commands]]
- [[_COMMUNITY_Theme Tag Notes|Theme Tag Notes]]
- [[_COMMUNITY_App Router|App Router]]
- [[_COMMUNITY_Dream List Component|Dream List Component]]
- [[_COMMUNITY_Graph Stats Component|Graph Stats Component]]
- [[_COMMUNITY_App Layout|App Layout]]
- [[_COMMUNITY_Tag Apply Dialog|Tag Apply Dialog]]
- [[_COMMUNITY_Tag Badge Component|Tag Badge Component]]
- [[_COMMUNITY_Dreams Hook|Dreams Hook]]
- [[_COMMUNITY_Tags Hook|Tags Hook]]
- [[_COMMUNITY_API Error Handling|API Error Handling]]
- [[_COMMUNITY_Calendar Page|Calendar Page]]
- [[_COMMUNITY_Graph Page|Graph Page]]
- [[_COMMUNITY_Journal Page|Journal Page]]
- [[_COMMUNITY_Theme Analysis Page|Theme Analysis Page]]
- [[_COMMUNITY_Tauri Build Entry|Tauri Build Entry]]
- [[_COMMUNITY_Tauri Library|Tauri Library]]
- [[_COMMUNITY_Tauri Main Entry|Tauri Main Entry]]
- [[_COMMUNITY_DB Migrations|DB Migrations]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Vite Config|Vite Config]]
- [[_COMMUNITY_React Entry|React Entry]]
- [[_COMMUNITY_Vite Types|Vite Types]]
- [[_COMMUNITY_Dream Viewer|Dream Viewer]]
- [[_COMMUNITY_Tag Highlight Extension|Tag Highlight Extension]]
- [[_COMMUNITY_Header Layout|Header Layout]]
- [[_COMMUNITY_Sidebar Layout|Sidebar Layout]]
- [[_COMMUNITY_Badge UI|Badge UI]]
- [[_COMMUNITY_Button UI|Button UI]]
- [[_COMMUNITY_Card UI|Card UI]]
- [[_COMMUNITY_Dialog UI|Dialog UI]]
- [[_COMMUNITY_Dropdown Menu UI|Dropdown Menu UI]]
- [[_COMMUNITY_Input UI|Input UI]]
- [[_COMMUNITY_Label UI|Label UI]]
- [[_COMMUNITY_Popover UI|Popover UI]]
- [[_COMMUNITY_Scroll Area UI|Scroll Area UI]]
- [[_COMMUNITY_Select UI|Select UI]]
- [[_COMMUNITY_Separator UI|Separator UI]]
- [[_COMMUNITY_Slider UI|Slider UI]]
- [[_COMMUNITY_Switch UI|Switch UI]]
- [[_COMMUNITY_Tabs UI|Tabs UI]]
- [[_COMMUNITY_Textarea UI|Textarea UI]]
- [[_COMMUNITY_Tooltip UI|Tooltip UI]]
- [[_COMMUNITY_Archetypes Page|Archetypes Page]]
- [[_COMMUNITY_Guide Page|Guide Page]]
- [[_COMMUNITY_Dream Store|Dream Store]]
- [[_COMMUNITY_Tag Store|Tag Store]]
- [[_COMMUNITY_Theme Store|Theme Store]]
- [[_COMMUNITY_UI Store|UI Store]]
- [[_COMMUNITY_Cytoscape Types|Cytoscape Types]]
- [[_COMMUNITY_Rust Commands Module|Rust Commands Module]]
- [[_COMMUNITY_Persona Archetype|Persona Archetype]]
- [[_COMMUNITY_Great Mother Archetype|Great Mother Archetype]]
- [[_COMMUNITY_Trickster Archetype|Trickster Archetype]]
- [[_COMMUNITY_Maiden Kore Archetype|Maiden Kore Archetype]]
- [[_COMMUNITY_Father Archetype|Father Archetype]]
- [[_COMMUNITY_Lover Archetype|Lover Archetype]]
- [[_COMMUNITY_Small App Icon|Small App Icon]]

## God Nodes (most connected - your core abstractions)
1. `Dreams Application` - 40 edges
2. `analyze()` - 13 edges
3. `Dreams Project (CLAUDE.md)` - 13 edges
4. `Graph Theory Analysis Panel` - 8 edges
5. `Collective Unconscious (Jung)` - 7 edges
6. `Citation: The Archetypes and the Collective Unconscious (Jung, CW Vol. 9i)` - 6 edges
7. `Weighted Adjacency Matrix (W)` - 6 edges
8. `Dreams App Icon (128x128)` - 6 edges
9. `build_adjacency_matrix()` - 5 edges
10. `node_order()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Build a weighted undirected adjacency matrix W.      W[i][j] = number of dream` --rationale_for--> `build_adjacency_matrix()`  [EXTRACTED]
  src-python\graph_analysis.py → src-tauri\resources\graph_analysis.py
- `Order (unweighted degree) of node i.      order(i) = |{ j : W[i][j] > 0 }|` --rationale_for--> `node_order()`  [EXTRACTED]
  src-python\graph_analysis.py → src-tauri\resources\graph_analysis.py
- `Strength of node i — the weighted analogue of degree.      s(i) = Σⱼ W[i][j]` --rationale_for--> `node_strength()`  [EXTRACTED]
  src-python\graph_analysis.py → src-tauri\resources\graph_analysis.py
- `Weight of the direct edge between nodes i and j.      w(i, j) = W[i][j]` --rationale_for--> `weighted_connection()`  [EXTRACTED]
  src-python\graph_analysis.py → src-tauri\resources\graph_analysis.py
- `Return the top-n nodes sorted by descending metric value (value > 0 only).` --rationale_for--> `top_n_nodes()`  [EXTRACTED]
  src-python\graph_analysis.py → src-tauri\resources\graph_analysis.py

## Communities

### Community 0 - "Dream Journal Features & Docs"
Cohesion: 0.06
Nodes (46): Dream Journal Guide (GUIDE.md), Handwriting Scan Tips Section, How to Record Dreams (placeholder), Tagging and Organisation Section, AI Dream Analysis Button (#27), Professional/Analyst Mode, Auto-Match Tags Feature, Calendar View Feature (+38 more)

### Community 1 - "Graph Analysis Engine"
Cohesion: 0.11
Nodes (28): analyze(), betweenness_centrality(), build_adjacency_matrix(), clustering_coefficients(), find_triangles(), lift_scores(), node_order(), node_strength() (+20 more)

### Community 2 - "Tauri IPC Commands"
Cohesion: 0.09
Nodes (0): 

### Community 3 - "Python Backend Config"
Cohesion: 0.12
Nodes (16): Dreams Project (CLAUDE.md), FastAPI Endpoints, httpx ASGI Client (in-process), Just Build Commands, Literate Programming Style, Pydantic v2 Data Validation, Pyright Type Checker, Python 3.12+ Requirement (+8 more)

### Community 4 - "Data Models"
Cohesion: 0.13
Nodes (12): CreateDreamInput, CreateTagInput, Dream, ExportResult, SearchQuery, SearchResult, Tag, TagCategory (+4 more)

### Community 5 - "AI Claude Integration"
Cohesion: 0.19
Nodes (13): analyze_dream(), AnthropicRequest, AnthropicResponse, call_claude(), ContentBlock, DreamAnalysisResult, extract_json(), ImageSource (+5 more)

### Community 6 - "Graph Theory Concepts"
Cohesion: 0.22
Nodes (14): Bipartite Dream-Tag Graph, graph_analysis.py (referenced script), Node Order (Unweighted Degree), Node Strength (Weighted Degree), Weighted Tag Co-Occurrence Network, Vertex Contraction (Dream→Tag Graph), Weighted Adjacency Matrix (W), Weighted Centrality (Normalised Strength) (+6 more)

### Community 7 - "Handwriting Preview UI"
Cohesion: 0.26
Nodes (9): autoMatchTags(), extractWordTagAssociations(), generateTitle(), handleClose(), handleSaveAll(), handleSaveCurrent(), handleSkip(), handleTranscriptSwitch() (+1 more)

### Community 8 - "Jungian Archetypes Theory"
Cohesion: 0.23
Nodes (13): Archetype: Anima / Animus, Archetype: The Child (Puer Aeternus), Citation: Archetypal Psychology: A Brief Account (Hillman, 1983), Citation: The Archetypes and the Collective Unconscious (Jung, CW Vol. 9i), Citation: King, Warrior, Magician, Lover (Moore & Gillette, 1990), Collective Unconscious (Jung), Archetype: The Hero, Individuation (Jungian Process) (+5 more)

### Community 9 - "Graph Data Structures"
Cohesion: 0.24
Nodes (10): build_graph_input(), get_graph_stats(), GraphEdgeAffinityStat, GraphEdgeLiftStat, GraphEdgeStat, GraphNodeStat, GraphStatsResult, GraphTriangle (+2 more)

### Community 10 - "Graph View Controls"
Cohesion: 0.22
Nodes (2): startSim(), stopSim()

### Community 11 - "Rust Tag Commands"
Cohesion: 0.36
Nodes (6): create_tag(), get_tag(), get_tags(), parse_aliases(), serialize_aliases(), update_tag()

### Community 12 - "Dream CRUD Operations"
Cohesion: 0.39
Nodes (5): create_dream(), get_dream(), get_dream_tags(), get_dreams(), update_dream()

### Community 13 - "Handwriting Upload UI"
Cohesion: 0.38
Nodes (4): addFiles(), fileToBase64(), handleFileSelect(), processImages()

### Community 14 - "Obsidian Export"
Cohesion: 0.48
Nodes (5): create_index_file(), export_dream(), export_tag(), export_to_obsidian(), get_dream_tags()

### Community 15 - "Theme Provider"
Cohesion: 0.33
Nodes (0): 

### Community 16 - "Dream Editor"
Cohesion: 0.4
Nodes (2): makeRemoveTagCommand(), removeTagMarksFromEditor()

### Community 17 - "Utility Functions"
Cohesion: 0.33
Nodes (0): 

### Community 18 - "Settings Page"
Cohesion: 0.33
Nodes (0): 

### Community 19 - "Archetype State Store"
Cohesion: 0.4
Nodes (2): initializeArchetypes(), loadArchetypes()

### Community 20 - "Tag Picker Component"
Cohesion: 0.5
Nodes (2): isSelected(), toggleTag()

### Community 21 - "Professional Analyst Page"
Cohesion: 0.5
Nodes (2): handleStartQueue(), parseTextFile()

### Community 22 - "Tags Management Page"
Cohesion: 0.5
Nodes (2): handleSave(), parseAliasesInput()

### Community 23 - "Analyst State Store"
Cohesion: 0.4
Nodes (0): 

### Community 24 - "Database Connection"
Cohesion: 0.6
Nodes (3): DbConnection, get_db_path(), init_db()

### Community 25 - "App Icon & Branding"
Cohesion: 0.7
Nodes (5): Crescent Moon Shape, Dream Icon SVG, Dreams Application, Indigo/Purple Color (#6366f1), Night / Dream Theme

### Community 26 - "App Icon Assets"
Cohesion: 0.7
Nodes (5): Dreams App Icon (128x128), White/Light Background, Medium Slate Blue Color (#7B7FE8 approx), Crescent Moon Symbol, Dreams Journal Application

### Community 27 - "Search Dialog"
Cohesion: 0.5
Nodes (0): 

### Community 28 - "Dream Series Page"
Cohesion: 0.5
Nodes (0): 

### Community 29 - "Dream Series Store"
Cohesion: 0.5
Nodes (0): 

### Community 30 - "High-DPI Icon Assets"
Cohesion: 0.67
Nodes (4): Dreams App Icon (Crescent Moon), Medium Slate Blue Color (#6B6BF5 approx), Crescent Moon Symbol, Dreams Application

### Community 31 - "Calendar View"
Cohesion: 0.67
Nodes (0): 

### Community 32 - "Dream Card Component"
Cohesion: 0.67
Nodes (0): 

### Community 33 - "Tag Utility Functions"
Cohesion: 0.67
Nodes (0): 

### Community 34 - "OCR Handwriting"
Cohesion: 1.0
Nodes (2): recognize_handwriting(), run_ocr()

### Community 35 - "Search Commands"
Cohesion: 1.0
Nodes (2): get_dream_tags(), search_dreams()

### Community 36 - "Theme Tag Notes"
Cohesion: 0.67
Nodes (0): 

### Community 37 - "App Router"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Dream List Component"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Graph Stats Component"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "App Layout"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Tag Apply Dialog"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Tag Badge Component"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Dreams Hook"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Tags Hook"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "API Error Handling"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Calendar Page"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Graph Page"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Journal Page"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Theme Analysis Page"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Tauri Build Entry"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Tauri Library"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Tauri Main Entry"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "DB Migrations"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Tailwind Config"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Vite Config"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "React Entry"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Vite Types"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Dream Viewer"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Tag Highlight Extension"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Header Layout"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Sidebar Layout"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Badge UI"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Button UI"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Card UI"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Dialog UI"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Dropdown Menu UI"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Input UI"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Label UI"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Popover UI"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Scroll Area UI"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Select UI"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Separator UI"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Slider UI"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Switch UI"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Tabs UI"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Textarea UI"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Tooltip UI"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Archetypes Page"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "Guide Page"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "Dream Store"
Cohesion: 1.0
Nodes (0): 

### Community 82 - "Tag Store"
Cohesion: 1.0
Nodes (0): 

### Community 83 - "Theme Store"
Cohesion: 1.0
Nodes (0): 

### Community 84 - "UI Store"
Cohesion: 1.0
Nodes (0): 

### Community 85 - "Cytoscape Types"
Cohesion: 1.0
Nodes (0): 

### Community 86 - "Rust Commands Module"
Cohesion: 1.0
Nodes (0): 

### Community 87 - "Persona Archetype"
Cohesion: 1.0
Nodes (1): Archetype: The Persona

### Community 88 - "Great Mother Archetype"
Cohesion: 1.0
Nodes (1): Archetype: The Great Mother

### Community 89 - "Trickster Archetype"
Cohesion: 1.0
Nodes (1): Archetype: The Trickster

### Community 90 - "Maiden Kore Archetype"
Cohesion: 1.0
Nodes (1): Archetype: The Maiden / Kore

### Community 91 - "Father Archetype"
Cohesion: 1.0
Nodes (1): Archetype: The Father

### Community 92 - "Lover Archetype"
Cohesion: 1.0
Nodes (1): Archetype: The Lover

### Community 93 - "Small App Icon"
Cohesion: 1.0
Nodes (1): Dreams App Icon (32x32)

## Knowledge Gaps
- **85 isolated node(s):** `Build a weighted undirected adjacency matrix W.      W[i][j] = number of dream`, `Order (unweighted degree) of node i.      order(i) = |{ j : W[i][j] > 0 }|`, `Strength of node i — the weighted analogue of degree.      s(i) = Σⱼ W[i][j]`, `Weight of the direct edge between nodes i and j.      w(i, j) = W[i][j]`, `Return the top-n nodes sorted by descending metric value (value > 0 only).` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `App Router`** (2 nodes): `renderPage()`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dream List Component`** (2 nodes): `DreamList()`, `DreamList.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Graph Stats Component`** (2 nodes): `handleCompute()`, `GraphStats.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Layout`** (2 nodes): `AppLayout()`, `AppLayout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tag Apply Dialog`** (2 nodes): `TagApplyDialog.tsx`, `TagApplyDialog()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tag Badge Component`** (2 nodes): `TagBadge.tsx`, `TagBadge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dreams Hook`** (2 nodes): `useDreams.ts`, `useDreams()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tags Hook`** (2 nodes): `useTags.ts`, `useTags()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API Error Handling`** (2 nodes): `friendlyApiError()`, `apiError.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Calendar Page`** (2 nodes): `CalendarPage()`, `CalendarPage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Graph Page`** (2 nodes): `GraphPage()`, `GraphPage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Journal Page`** (2 nodes): `JournalPage()`, `JournalPage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Analysis Page`** (2 nodes): `ThemeAnalysisPage.tsx`, `getLevel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tauri Build Entry`** (2 nodes): `main()`, `build.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tauri Library`** (2 nodes): `run()`, `lib.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tauri Main Entry`** (2 nodes): `main()`, `main.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DB Migrations`** (2 nodes): `run_migrations()`, `mod.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Config`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Config`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Entry`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Types`** (1 nodes): `vite-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dream Viewer`** (1 nodes): `DreamViewer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tag Highlight Extension`** (1 nodes): `TagHighlightExtension.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Header Layout`** (1 nodes): `Header.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sidebar Layout`** (1 nodes): `Sidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Badge UI`** (1 nodes): `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Button UI`** (1 nodes): `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Card UI`** (1 nodes): `card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dialog UI`** (1 nodes): `dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dropdown Menu UI`** (1 nodes): `dropdown-menu.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Input UI`** (1 nodes): `input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Label UI`** (1 nodes): `label.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Popover UI`** (1 nodes): `popover.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scroll Area UI`** (1 nodes): `scroll-area.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Select UI`** (1 nodes): `select.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Separator UI`** (1 nodes): `separator.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Slider UI`** (1 nodes): `slider.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Switch UI`** (1 nodes): `switch.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tabs UI`** (1 nodes): `tabs.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Textarea UI`** (1 nodes): `textarea.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tooltip UI`** (1 nodes): `tooltip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Archetypes Page`** (1 nodes): `ArchetypesPage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Guide Page`** (1 nodes): `GuidePage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dream Store`** (1 nodes): `dreamStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tag Store`** (1 nodes): `tagStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Store`** (1 nodes): `themeStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Store`** (1 nodes): `uiStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cytoscape Types`** (1 nodes): `cytoscape-fcose.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Rust Commands Module`** (1 nodes): `mod.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Persona Archetype`** (1 nodes): `Archetype: The Persona`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Great Mother Archetype`** (1 nodes): `Archetype: The Great Mother`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Trickster Archetype`** (1 nodes): `Archetype: The Trickster`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Maiden Kore Archetype`** (1 nodes): `Archetype: The Maiden / Kore`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Father Archetype`** (1 nodes): `Archetype: The Father`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Lover Archetype`** (1 nodes): `Archetype: The Lover`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Small App Icon`** (1 nodes): `Dreams App Icon (32x32)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Dreams Application` connect `Dream Journal Features & Docs` to `Jungian Archetypes Theory`, `Python Backend Config`, `Graph Theory Concepts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `Dreams Project (CLAUDE.md)` connect `Python Backend Config` to `Dream Journal Features & Docs`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `Graph Theory Analysis Panel` connect `Graph Theory Concepts` to `Dream Journal Features & Docs`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Collective Unconscious (Jung)` (e.g. with `Archetype: The Shadow` and `Archetype: Anima / Animus`) actually correct?**
  _`Collective Unconscious (Jung)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Build a weighted undirected adjacency matrix W.      W[i][j] = number of dream`, `Order (unweighted degree) of node i.      order(i) = |{ j : W[i][j] > 0 }|`, `Strength of node i — the weighted analogue of degree.      s(i) = Σⱼ W[i][j]` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dream Journal Features & Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Graph Analysis Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._