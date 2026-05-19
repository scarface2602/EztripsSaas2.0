import { requireSuperAdmin } from '@/lib/auth/require-role';
import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Globe, Inbox, MapPin, FileText, Package, ArrowRight, LayoutList, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function WebsiteCMSPage() {
  await requireSuperAdmin();
  const supabase = createServiceClient();

  const [
    { count: totalEnquiries },
    { count: newEnquiries },
    { count: publishedDestinations },
    { count: publishedBlogPosts },
    { count: publishedPages },
    { data: recentEnquiries },
  ] = await Promise.all([
    supabase.from('website_enquiries').select('*', { count: 'exact', head: true }),
    supabase.from('website_enquiries').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('website_destinations').select('*', { count: 'exact', head: true }).eq('published', true),
    supabase.from('website_blog_posts').select('*', { count: 'exact', head: true }).eq('published', true),
    supabase.from('website_pages').select('*', { count: 'exact', head: true }).eq('published', true),
    supabase.from('website_enquiries').select('*').order('created_at', { ascending: false }).limit(5),
  ]);

  const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-yellow-100 text-yellow-700',
    closed: 'bg-green-100 text-green-700',
    spam: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Globe className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Website CMS</h1>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Enquiries</p>
            <p className="text-3xl font-bold">{totalEnquiries ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">New Enquiries</p>
            <p className="text-3xl font-bold text-blue-600">{newEnquiries ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Published Destinations</p>
            <p className="text-3xl font-bold">{publishedDestinations ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Published Blog Posts</p>
            <p className="text-3xl font-bold">{publishedBlogPosts ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Published Pages</p>
            <p className="text-3xl font-bold">{publishedPages ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { href: '/admin/website/homepage', icon: Home, label: 'Homepage' },
          { href: '/admin/website/enquiries', icon: Inbox, label: 'Enquiries' },
          { href: '/admin/website/pages', icon: LayoutList, label: 'Pages' },
          { href: '/admin/website/destinations', icon: MapPin, label: 'Destinations' },
          { href: '/admin/website/blog', icon: FileText, label: 'Blog Posts' },
          { href: '/admin/website/packages', icon: Package, label: 'Packages' },
        ].map(link => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <link.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{link.label}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Enquiries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Enquiries</CardTitle>
          <Link href="/admin/website/enquiries">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {!recentEnquiries?.length ? (
            <p className="text-sm text-muted-foreground">No enquiries yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>WhatsApp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEnquiries.map((e: Record<string, unknown>) => {
                  const phone = (e.phone as string || '').replace(/\D/g, '').replace(/^0+/, '');
                  const waPhone = phone.startsWith('91') ? phone : `91${phone}`;
                  return (
                    <TableRow key={e.id as string}>
                      <TableCell className="font-medium">{e.name as string}</TableCell>
                      <TableCell>{e.destination as string}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[(e.status as string) || 'new']}>
                          {e.status as string}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(e.created_at as string).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://wa.me/${waPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline text-sm"
                        >
                          Chat
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
