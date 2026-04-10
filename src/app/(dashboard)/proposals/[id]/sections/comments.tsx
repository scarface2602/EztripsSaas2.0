'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface CommentsSectionProps {
  proposalId: string;
  comments: Record<string, unknown>[];
  setComments: (comments: Record<string, unknown>[]) => void;
  currentUser: User;
}

export function CommentsSection({ proposalId, comments, setComments, currentUser }: CommentsSectionProps) {
  const supabase = createClient();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);

    // Extract @mentions
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(message)) !== null) {
      mentions.push(match[1]);
    }

    const { data } = await supabase.from('proposal_comments').insert({
      proposal_id: proposalId,
      user_id: currentUser.id,
      message: message.trim(),
      mentions: [],
    }).select('*, users(full_name)').single();

    if (data) {
      setComments([...comments, data]);
      setMessage('');
    }
    setSending(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Internal Comments</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">Only visible to proposal owner and super admins. Never shown to clients.</p>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
          ) : (
            comments.map((comment, i) => {
              const user = comment.users as Record<string, unknown> | null;
              const isOwn = (comment.user_id as string) === currentUser.id;
              return (
                <div key={i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p className="text-xs font-medium mb-1">
                      {user?.full_name as string || 'Unknown'}
                      <span className="font-normal ml-2 opacity-70">
                        {new Date(comment.created_at as string).toLocaleString()}
                      </span>
                    </p>
                    <p className="text-sm">{comment.message as string}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a comment... Use @name to mention"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
          <Button onClick={handleSend} disabled={sending || !message.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
