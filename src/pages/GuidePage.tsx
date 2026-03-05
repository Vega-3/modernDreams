import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function GuidePage() {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/GUIDE.md')
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.text();
      })
      .then(setContent)
      .catch(() =>
        setError(
          "Couldn't load the guide. Make sure GUIDE.md exists in the app's public folder."
        )
      );
  }, []);

  return (
    <div className="flex-1 flex flex-col p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <BookOpen className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Guide</h1>
      </div>

      <ScrollArea className="flex-1">
        {error ? (
          <p className="text-muted-foreground">{error}</p>
        ) : (
          <div className="guide-content space-y-4 text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold mt-6 mb-3 text-foreground">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold mt-5 mb-2 text-foreground">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-foreground/80 mb-3">{children}</p>
                ),
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
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-muted-foreground">{children}</em>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
