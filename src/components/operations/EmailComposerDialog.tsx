'use client';

import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Paperclip, Upload, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

export interface EmailComposerData {
  action: string;
  item_id: string;
  booking_id: string;
  to: string;
  cc: string;
  subject: string;
  html_body: string;
  // Extra fields from the action form
  vendor_name?: string;
  vendor_email?: string;
  supplier_reference?: string;
  supplier_notes?: string;
  payment_due_date?: string;
}

interface EmailComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: EmailComposerData | null;
  onSend: (payload: {
    action: string;
    item_id: string;
    to: string;
    cc: string;
    html_body: string;
    attachments: File[];
    attach_system_voucher: boolean;
    vendor_name?: string;
    vendor_email?: string;
    supplier_reference?: string;
    supplier_notes?: string;
    payment_due_date?: string;
  }) => Promise<void>;
}

export function EmailComposerDialog({ open, onOpenChange, data, onSend }: EmailComposerDialogProps) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachVoucher, setAttachVoucher] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Sync from data when it changes
  React.useEffect(() => {
    if (data) {
      setTo(data.to || '');
      setCc(data.cc || '');
      setSubject(data.subject || '');
      setHtmlBody(data.html_body || '');
      setAttachments([]);
      setAttachVoucher(false);
    }
  }, [data]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(f => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    setAttachments(prev => [...prev, ...newFiles]);
  }, []);

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error('Recipient email is required');
      return;
    }
    if (!data) return;

    setSending(true);
    try {
      await onSend({
        action: data.action,
        item_id: data.item_id,
        to: to.trim(),
        cc: cc.trim(),
        html_body: htmlBody,
        attachments,
        attach_system_voucher: attachVoucher,
        vendor_name: data.vendor_name,
        vendor_email: to.trim(),
        supplier_reference: data.supplier_reference,
        supplier_notes: data.supplier_notes,
        payment_due_date: data.payment_due_date,
      });
      onOpenChange(false);
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Compose Email
            {data?.action && (
              <Badge variant="outline" className="text-xs capitalize">
                {data.action.replace(/_/g, ' ')}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* To / CC */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="supplier@email.com"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">CC</Label>
              <Input
                type="email"
                value={cc}
                onChange={e => setCc(e.target.value)}
                placeholder="Optional"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <Label className="text-xs">Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
              className="h-8 text-sm"
            />
          </div>

          {/* Body */}
          <div>
            <Label className="text-xs">Body</Label>
            <textarea
              className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
              value={htmlBody}
              onChange={e => setHtmlBody(e.target.value)}
              placeholder="Email body (HTML supported)..."
            />
          </div>

          {/* System voucher toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={attachVoucher}
              onCheckedChange={v => setAttachVoucher(v === true)}
            />
            <span className="text-sm">Attach System Generated B2B Voucher</span>
          </label>

          {/* File drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">
              Drag and drop PDFs here, or{' '}
              <label className="text-primary cursor-pointer hover:underline">
                browse
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={e => handleFileSelect(e.target.files)}
                />
              </label>
            </p>
          </div>

          {/* Attachment list */}
          {attachments.length > 0 && (
            <div className="space-y-1">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                  <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(file.size / 1024).toFixed(0)}KB
                  </span>
                  <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {attachVoucher && (
            <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1">
              <FileText className="h-3 w-3 text-blue-600 shrink-0" />
              <span className="text-blue-700 dark:text-blue-400">B2B Voucher (auto-generated)</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
