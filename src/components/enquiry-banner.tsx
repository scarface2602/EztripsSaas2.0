'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function EnquiryBanner({ enquiry }: { enquiry: any }) {
  const [open, setOpen] = useState(false);

  if (!enquiry) return null;

  return (
    <div className="mb-4 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
      <span className="text-blue-800">
        From enquiry by <span className="font-medium">{enquiry.name}</span> on{' '}
        {new Date(enquiry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className="ml-auto text-blue-600 hover:underline text-xs font-medium focus:outline-none">
          View enquiry
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Enquiry Details</DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 pb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Client Info</p>
                  <p className="font-medium">{enquiry.name}</p>
                  <p>{enquiry.email || '-'}</p>
                  <p>{enquiry.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Trip Overview</p>
                  <p><span className="font-medium">Destination:</span> {enquiry.destination || '-'}</p>
                  <p><span className="font-medium">Travel Date:</span> {enquiry.travel_date || enquiry.requirement_details?.travel_month || '-'}
                    {enquiry.date_flexible && <span className="text-xs text-muted-foreground ml-1">(flexible)</span>}
                  </p>
                  <p><span className="font-medium">Nights:</span> {enquiry.number_of_nights || '-'}</p>
                  <p><span className="font-medium">Pax:</span> {enquiry.adults || 0}A {enquiry.children > 0 ? `+ ${enquiry.children}C` : ''}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Preferences</p>
                  <p><span className="font-medium">Budget:</span> {enquiry.budget_range || '-'} {enquiry.budget_type ? `(${enquiry.budget_type})` : ''}</p>
                  <p><span className="font-medium">Hotel Category:</span> {enquiry.hotel_category || '-'}</p>
                  {enquiry.special_requirements && (
                    <p className="mt-2"><span className="font-medium block mb-1">Special Requirements:</span> {enquiry.special_requirements}</p>
                  )}
                </div>
                {enquiry.requirement_details && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Wizard Selections</p>
                    {enquiry.requirement_details.departure_city && (
                      <p className="mb-2">
                        <span className="font-medium text-xs">Origin Hub:</span>{' '}
                        <Badge variant="secondary" className="font-medium text-[11px]">
                          {enquiry.requirement_details.departure_city}
                        </Badge>
                      </p>
                    )}
                    {Array.isArray(enquiry.requirement_details.cities) && enquiry.requirement_details.cities.length > 0 && (
                      <div className="mb-2">
                        <span className="font-medium block text-xs mb-1">
                          {enquiry.requirement_details.is_pilgrimage ? 'Shrines:' : 'Cities:'}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {enquiry.requirement_details.cities.map((c: string) => (
                            <Badge key={c} variant="outline" className="text-[10px] bg-slate-50">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(enquiry.requirement_details.special_services) && enquiry.requirement_details.special_services.length > 0 && (
                      <div>
                        <span className="font-medium block text-xs mb-1">Services:</span>
                        <div className="flex flex-wrap gap-1">
                          {enquiry.requirement_details.special_services.map((s: string) => (
                            <Badge key={s} variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
