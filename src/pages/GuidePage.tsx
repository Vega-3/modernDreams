import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen, ChevronLeft, ChevronRight, MapPin, Tags, Calendar,
  Network, Brain, Palette, Moon, Search, PenLine, Star, FolderOpen,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Binder pages ──────────────────────────────────────────────────────────────

type BinderPage =
  | { id: 'walkthrough'; label: string; tab: string; kind: 'walkthrough' }
  | { id: string; label: string; tab: string; kind: 'markdown'; url: string };

const PAGES: BinderPage[] = [
  { id: 'walkthrough', label: 'App Walkthrough', tab: 'Walkthrough', kind: 'walkthrough' },
  { id: 'archetypes', label: 'Archetypes', tab: 'Archetypes', kind: 'markdown', url: '/ARCHETYPES.md' },
  { id: 'sleep', label: 'Sleep & Dream Recall', tab: 'Sleep & REM', kind: 'markdown', url: '/SLEEP.md' },
  { id: 'jungian', label: 'Jungian Analysis', tab: 'Jungian Methods', kind: 'markdown', url: '/JUNGIAN_ANALYSIS.md' },
  { id: 'guide', label: 'Using the Journal', tab: 'Guide', kind: 'markdown', url: '/GUIDE.md' },
];

// ── Markdown renderer ─────────────────────────────────────────────────────────

const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold mt-6 mb-3 text-foreground border-b border-border pb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold mt-5 mb-2 text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-4 mb-1.5 text-foreground">{children}</h3>
  ),
  p: ({ children }) => <p className="text-foreground/80 mb-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 mb-3 text-foreground/80">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 mb-3 text-foreground/80">{children}</ol>
  ),
  li: ({ children }) => <li className="ml-2">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground my-3">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border my-6" />,
  code: ({ children }) => (
    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
};

// ── Walkthrough ───────────────────────────────────────────────────────────────

interface WalkthroughStep {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  body: React.ReactNode;
  tip?: string;
  tryIt?: string;
}

const STEPS: WalkthroughStep[] = [
  {
    icon: Star,
    iconColor: 'text-yellow-400',
    title: 'Welcome to Ipsacarta',
    body: (
      <>
        <p>
          Ipsacarta is your <strong>personal dream journal</strong>. It lives entirely on your
          computer — nothing you write is ever sent to the internet or stored anywhere else.
          Your dreams are private, and they stay that way.
        </p>
        <p>
          Use it to write down what you dreamed, label recurring themes, and discover patterns
          in your sleeping mind over time. You don't need any special knowledge to get started —
          just the ability to remember (even a little) and the habit of writing.
        </p>
        <p>
          This walkthrough will show you everything, one step at a time. You can come back to
          any step whenever you like.
        </p>
      </>
    ),
    tip: 'You can navigate this guide using the Previous and Next buttons below, or jump to any step using the dots at the top.',
  },

  {
    icon: PenLine,
    iconColor: 'text-primary',
    title: 'Writing Your First Dream',
    body: (
      <>
        <p>
          The <strong>Journal</strong> is the main page — it's where all your dreams live.
          When you open the app, you'll already be looking at it.
        </p>
        <p>
          To record a new dream, click the <strong>"+ New Dream"</strong> button in the top-right
          corner of the screen. A form will slide open.
        </p>
        <ul>
          <li><strong>Title</strong> — a short name for the dream, like "The Flooded House" or "Dream 1". Anything works.</li>
          <li><strong>Date</strong> — the night you had the dream. It fills in today's date automatically.</li>
          <li><strong>Content</strong> — write what you remember. There is no minimum. A single sentence is perfectly fine.</li>
        </ul>
        <p>
          When you're done, click <strong>Save</strong>. Your dream will appear as a card in the Journal.
        </p>
      </>
    ),
    tip: "Don't worry about writing well. Fragmented sentences, single images, or just a feeling — it all counts. The act of writing trains your brain to remember more over time.",
    tryIt: 'Click "Journal" in the left sidebar, then click "+ New Dream" to write your first entry.',
  },

  {
    icon: Search,
    iconColor: 'text-blue-400',
    title: 'Reading & Finding Your Dreams',
    body: (
      <>
        <p>
          Every dream you save appears as a <strong>card</strong> in the Journal. The most recent
          dreams show at the top.
        </p>
        <p>
          Click any card to open and read it in full. From there you can also edit or delete it
          using the buttons that appear.
        </p>
        <p>
          To <strong>search</strong> for a specific dream, press <strong>Ctrl + K</strong> on your
          keyboard (or click the magnifying glass icon in the top bar). Type any word you
          remember — a place, a person, a feeling — and matching dreams will appear instantly.
        </p>
      </>
    ),
    tip: 'The app saves your work automatically as you type inside the dream editor. You will never lose a draft.',
    tryIt: 'Press Ctrl + K and type a word from a dream you remember.',
  },

  {
    icon: FolderOpen,
    iconColor: 'text-amber-400',
    title: 'Importing Many Dreams at Once',
    body: (
      <>
        <p>
          If you already have a collection of dreams written somewhere — in a notes app, Word
          documents, or plain text files — you can import them all into Ipsacarta in one go
          instead of copying and pasting each one by hand.
        </p>
        <p>
          <strong>Prepare your files.</strong> Each dream needs to be its own{' '}
          <strong>.txt file</strong> (a plain text file). Here's how the app reads them:
        </p>
        <ul>
          <li>
            <strong>The filename becomes the dream title.</strong> A file called{' '}
            <code>the-flooded-house.txt</code> will import as "The Flooded House".
          </li>
          <li>
            <strong>Optional: add the date on the very first line</strong>, written as{' '}
            <code>2024-03-15</code> (year-month-day). If you skip this, today's date is used.
          </li>
          <li>
            <strong>The rest of the file is your dream text.</strong> Write as much or as
            little as you like.
          </li>
        </ul>
        <p>
          <strong>How to import:</strong>
        </p>
        <ol>
          <li>Click <strong>Professional</strong> in the left sidebar.</li>
          <li>Turn on the <strong>Professional Mode</strong> toggle at the top.</li>
          <li>
            Click <strong>Add Client</strong> and type any name — for personal use, something
            like "Me" or "Personal" works fine. This is just a label the importer needs.
          </li>
          <li>Scroll down to the <strong>Bulk Dream Import</strong> section.</li>
          <li>Select your client name from the dropdown.</li>
          <li>
            Click <strong>Choose Files</strong> and select all your .txt dream files at once
            (hold Ctrl or Cmd to select multiple).
          </li>
          <li>Click <strong>Start Import</strong>.</li>
        </ol>
        <p>
          The dream editor will open for the first file. Check the text looks right, add any
          tags you want, then click <strong>Save</strong>. It will automatically move to the
          next file. Repeat until all dreams are saved.
        </p>
      </>
    ),
    tip: 'You can convert most document formats to .txt by opening them and choosing File → Save As → Plain Text. On Windows, Notepad saves .txt files by default.',
    tryIt: 'Try creating one .txt file with a dream, then use the Professional page to import it.',
  },

  {
    icon: Tags,
    iconColor: 'text-purple-400',
    title: 'Tags — Your Symbol Dictionary',
    body: (
      <>
        <p>
          <strong>Tags</strong> are labels you attach to recurring elements in your dreams —
          a person who keeps appearing, a place, an emotion, or a symbol.
        </p>
        <p>
          When writing a dream, click the <strong>Tags</strong> area inside the editor to add
          tags. You can create a new tag on the spot or reuse ones you've already made.
        </p>
        <p>
          Tags have five categories to help you stay organised:
        </p>
        <ul>
          <li><strong>Location</strong> — places (the old house, the forest, work)</li>
          <li><strong>Characters</strong> — people and beings (my mother, a stranger, a wolf)</li>
          <li><strong>Symbolic</strong> — objects and images (a key, water, fire)</li>
          <li><strong>Emotive</strong> — feelings (fear, joy, confusion)</li>
          <li><strong>Custom</strong> — anything that doesn't fit the above</li>
        </ul>
        <p>
          Over time, the tags you use most will reveal which symbols appear most often in your
          dream life — things you might not have noticed consciously.
        </p>
      </>
    ),
    tip: 'Start simple. Create 3–5 tags for the most common things in your dreams and add more as you go. You can manage all your tags from the Tags page in the sidebar.',
    tryIt: 'Go to the Tags page and create a tag for something that often appears in your dreams.',
  },

  {
    icon: MapPin,
    iconColor: 'text-green-400',
    title: 'Highlighting Words in a Dream',
    body: (
      <>
        <p>
          Inside the dream editor, you can highlight a specific word or phrase and link it
          directly to a tag. This is called <strong>inline tagging</strong>.
        </p>
        <p>
          For example, if you write "I was running through the <em>forest</em>" and you have a
          "Forest" tag, you can select the word "forest" with your mouse and then click the
          tag in the small menu that appears above it.
        </p>
        <p>
          The word will be highlighted in that tag's colour. Later, in the Constellation view,
          the app will know not just that "Forest" appeared in a dream, but <em>which paragraph</em>
          it appeared in — making connections more accurate.
        </p>
      </>
    ),
    tip: 'Inline highlighting is optional. You can tag a whole dream without highlighting individual words and everything still works.',
    tryIt: 'Open an existing dream, select a word, and see the tag menu appear above it.',
  },

  {
    icon: Calendar,
    iconColor: 'text-orange-400',
    title: 'The Calendar',
    body: (
      <>
        <p>
          The <strong>Calendar</strong> page (in the left sidebar) shows your dreams arranged
          by the date you had them.
        </p>
        <p>
          Days where you recorded a dream are marked. Click any marked day to see the dream
          from that night. You can switch between <strong>month view</strong> and
          <strong>week view</strong> using the buttons at the top.
        </p>
        <p>
          The Calendar makes it easy to spot gaps in your journalling habit, or to find a dream
          you remember having "a few weeks ago on a Tuesday" without having to scroll through
          everything.
        </p>
      </>
    ),
    tip: "Journalling every day — even writing 'No dream remembered' — builds the habit faster than journalling only when you remember something.",
    tryIt: 'Click "Calendar" in the sidebar. If you have any saved dreams, they will appear on their dates.',
  },

  {
    icon: Network,
    iconColor: 'text-cyan-400',
    title: 'The Constellation — Seeing Connections',
    body: (
      <>
        <p>
          The <strong>Constellation</strong> page draws a visual map of your dream world.
          Each dot is one of your tags. Lines connect tags that appeared in the same dream.
        </p>
        <p>
          Tags that appear together <em>often</em> are drawn closer together. Tags that rarely
          share a dream drift apart. After a few weeks of journalling, patterns emerge that are
          genuinely surprising — symbols you didn't realise were linked.
        </p>
        <p>
          Use the <strong>filter toggles</strong> in the top-left corner to show or hide
          different tag categories. Try hiding the dream nodes themselves — the map will
          collapse into a clean web showing only how your symbols relate to each other.
        </p>
      </>
    ),
    tip: "The Constellation is most useful after you've logged at least 10–15 dreams with tags. It needs data to show meaningful patterns.",
    tryIt: 'Click "Constellation" in the sidebar. Try dragging the dots around to rearrange the map.',
  },

  {
    icon: Brain,
    iconColor: 'text-pink-400',
    title: 'AI Features (Optional)',
    body: (
      <>
        <p>
          Ipsacarta includes optional AI tools that can speed up your journalling. These are
          completely optional — every other feature works without them.
        </p>
        <ul>
          <li>
            <strong>Handwriting Scan</strong> — take a photo of handwritten dream notes and the
            app will read them and type them out for you.
          </li>
          <li>
            <strong>AI Analyse</strong> — reads your dream and suggests tags from your own tag
            library that might fit, plus brief Jungian theme notes.
          </li>
          <li>
            <strong>AI Tag</strong> — automatically highlights words in the dream text that match
            your existing tags.
          </li>
        </ul>
        <p>
          To use AI features you need an <strong>Anthropic API key</strong>. Think of it like
          a password that gives you access to the AI. You can get one for free at{' '}
          <strong>console.anthropic.com</strong>. Once you have it, paste it in{' '}
          <strong>Settings → Anthropic API Key</strong>.
        </p>
      </>
    ),
    tip: "The AI costs a very small amount per use — usually a fraction of a cent. You only pay for what you use, and you can set a spending limit in your Anthropic account.",
  },

  {
    icon: Palette,
    iconColor: 'text-violet-400',
    title: 'Themes & Appearance',
    body: (
      <>
        <p>
          You can change how the app looks at any time. Go to <strong>Settings</strong> (the
          gear icon at the bottom of the left sidebar) and click <strong>Appearance</strong>.
        </p>
        <p>
          Choose from several built-in <strong>themes</strong> — each one changes the colours,
          fonts, and overall feel of the app:
        </p>
        <ul>
          <li><strong>Mementos</strong> — bold and dramatic (the default)</li>
          <li><strong>Base</strong> — clean and minimal, good for long reading sessions</li>
          <li><strong>Clarity</strong> — high contrast, large text, designed for accessibility</li>
          <li><strong>Neon Noir</strong> — dark with vivid cyan accents</li>
          <li><strong>Bauhaus</strong> — geometric and flat, inspired by Mondrian</li>
          <li><strong>Greco-Roman</strong> — warm dark theme with gold accents and classical typography</li>
        </ul>
        <p>
          You can also change the font, set a custom background image, or inject your own CSS
          if you're familiar with web design.
        </p>
      </>
    ),
    tip: "Switching themes automatically updates the tag colours throughout the app to match the new palette.",
    tryIt: 'Open Settings → Appearance and try switching to a different theme.',
  },

  {
    icon: Moon,
    iconColor: 'text-indigo-400',
    title: 'Tips for Remembering More Dreams',
    body: (
      <>
        <p>
          Dream recall is a skill — it gets better with practice. Here are the habits that
          work best:
        </p>
        <ul>
          <li>
            <strong>Write immediately on waking.</strong> Dreams fade within minutes. Before
            checking your phone or getting up, open the app (or grab a notebook) and write.
          </li>
          <li>
            <strong>Don't move suddenly.</strong> Lying still for a moment when you first wake
            gives the dream memory time to surface.
          </li>
          <li>
            <strong>Write in the present tense.</strong> "I am standing in a corridor" rather
            than "I was standing in a corridor." It keeps the memory closer.
          </li>
          <li>
            <strong>Start with feelings, not plot.</strong> If you can't remember what happened,
            write how the dream felt. The images often follow.
          </li>
          <li>
            <strong>Record everything, even fragments.</strong> "Green light. Water. Running."
            is a valid entry. It still builds the habit, and sometimes the fragment is enough
            for a tag or two.
          </li>
          <li>
            <strong>Write at a consistent time.</strong> Your brain learns to remember dreams
            when it expects to be asked about them.
          </li>
        </ul>
      </>
    ),
    tip: 'Most people who journal consistently for two weeks report a significant increase in how much they remember. The first few days are the hardest.',
  },
];

function WalkthroughTab() {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const total = STEPS.length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Progress dots ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 pt-6 pb-2 shrink-0">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            aria-label={`Go to step ${i + 1}`}
            className={cn(
              'rounded-full transition-all duration-200',
              i === step
                ? 'w-5 h-2 bg-primary'
                : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'
            )}
          />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground pb-4 shrink-0">
        Step {step + 1} of {total}
      </p>

      {/* ── Step content ──────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-2xl mx-auto px-8 pb-6">
          {/* Icon + Title */}
          <div className="flex items-center gap-4 mb-5">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <Icon className={cn('h-7 w-7', current.iconColor)} />
            </div>
            <h2 className="text-2xl font-bold text-foreground leading-tight">{current.title}</h2>
          </div>

          {/* Body text */}
          <div className="space-y-3 text-base leading-relaxed text-foreground/85 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:space-y-2 [&_li]:ml-3 [&_li]:list-disc [&_li]:list-outside [&_strong]:text-foreground [&_strong]:font-semibold [&_em]:text-muted-foreground [&_em]:italic">
            {current.body}
          </div>

          {/* Try it box */}
          {current.tryIt && (
            <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Try it now</p>
              <p className="text-sm text-foreground/80">{current.tryIt}</p>
            </div>
          )}

          {/* Tip box */}
          {current.tip && (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tip</p>
              <p className="text-sm text-foreground/70">{current.tip}</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-8 py-4 border-t bg-card/40">
        <Button
          variant="outline"
          size="sm"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <span className="text-xs text-muted-foreground">{current.title}</span>

        {step < total - 1 ? (
          <Button
            size="sm"
            onClick={() => setStep((s) => s + 1)}
            className="gap-1.5"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStep(0)}
            className="gap-1.5"
          >
            Start over
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GuidePage() {
  const [activePage, setActivePage] = useState(0);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Pre-fetch all markdown pages eagerly
  useEffect(() => {
    PAGES.forEach((p) => {
      if (p.kind !== 'markdown') return;
      fetch(p.url)
        .then((r) => {
          if (!r.ok) throw new Error('not found');
          return r.text();
        })
        .then((text) => setContents((prev) => ({ ...prev, [p.id]: text })))
        .catch(() => setErrors((prev) => ({ ...prev, [p.id]: true })));
    });
  }, []);

  const page = PAGES[activePage];

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-0">
      {/* ── Binder spine / tabs ─────────────────────────────────────────────── */}
      <div className="flex flex-col w-36 shrink-0 border-r bg-card/60">
        <div className="flex items-center gap-2 px-3 py-3 border-b">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold tracking-tight">Guide</span>
        </div>

        <nav className="flex-1 py-2 space-y-0.5 px-1.5">
          {PAGES.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActivePage(i)}
              className={cn(
                'w-full text-left px-2.5 py-2 rounded text-xs transition-all leading-tight',
                i === activePage
                  ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {p.tab}
            </button>
          ))}
        </nav>

        <div className="flex items-center justify-between px-2 py-2 border-t">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={activePage === 0}
            onClick={() => setActivePage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {activePage + 1} / {PAGES.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={activePage === PAGES.length - 1}
            onClick={() => setActivePage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-6 py-2.5 border-b bg-muted/30 shrink-0">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {page.label}
          </span>
        </div>

        {page.kind === 'walkthrough' ? (
          <WalkthroughTab />
        ) : (
          <ScrollArea className="flex-1">
            <div className="max-w-3xl mx-auto px-8 py-6">
              {errors[page.id] ? (
                <p className="text-muted-foreground text-sm">
                  Couldn't load {page.label}. Make sure the file exists in the app's public folder.
                </p>
              ) : !contents[page.id] ? (
                <p className="text-muted-foreground text-sm animate-pulse">Loading…</p>
              ) : (
                <div className="guide-content space-y-1 text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                    {contents[page.id]}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
