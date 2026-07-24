import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { SmartPanel, SmartPanelFooter } from "@/components/ui/smart-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { AppIcon } from "@/components/icons";
import {
  User,
  Mail,
  Building,
  Calendar,
  Star,
  CheckCircle,
  Search,
  MoreHorizontal,
  FileSpreadsheet,
  FileText,
  FileCode,
  Eye,
  Pencil,
  Trash2,
  BarChart3,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

const sampleData = [
  {
    id: "001",
    name: "Sarah Johnson",
    email: "sarah.j@techcorp.com",
    company: "TechCorp Industries",
    department: "Engineering",
    position: "Senior Developer",
    submittedAt: "2025-01-12 14:30",
    status: "approved" as const,
    rating: 5,
    formType: "Employee Feedback",
  },
  {
    id: "002",
    name: "Michael Chen",
    email: "m.chen@startupxyz.io",
    company: "StartupXYZ",
    department: "Product",
    position: "Product Manager",
    submittedAt: "2025-01-12 11:15",
    status: "pending" as const,
    rating: 4,
    formType: "Feature Request",
  },
  {
    id: "003",
    name: "Elena Rodriguez",
    email: "elena.r@globalsolutions.com",
    company: "Global Solutions Ltd",
    department: "Marketing",
    position: "Marketing Director",
    submittedAt: "2025-01-12 09:45",
    status: "review" as const,
    rating: 5,
    formType: "Partnership Inquiry",
  },
  {
    id: "004",
    name: "David Kim",
    email: "david.kim@innovate.co",
    company: "Innovate Co",
    department: "Sales",
    position: "Account Executive",
    submittedAt: "2025-01-11 16:20",
    status: "approved" as const,
    rating: 3,
    formType: "Customer Onboarding",
  },
  {
    id: "005",
    name: "Amanda Foster",
    email: "a.foster@enterprises.com",
    company: "Enterprise Solutions",
    department: "HR",
    position: "HR Manager",
    submittedAt: "2025-01-11 13:55",
    status: "rejected" as const,
    rating: 2,
    formType: "Vendor Application",
  },
];

const statusMap = {
  approved: "approved",
  pending: "pending",
  review: "review",
  rejected: "rejected",
} as const;

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <AppIcon
          key={i}
          icon={Star}
          size="xs"
          className={i < rating ? "text-warning fill-warning" : "text-muted-foreground/35"}
        />
      ))}
    </div>
  );
}

export default function DataTablePreview() {
  return (
    <section aria-labelledby="table-preview-heading" className="container mx-auto px-4">
      <SmartPanel
        id="table-preview-heading"
        title="Smart Data Tables"
        description="Powerful data visualization with filtering, sorting, and real-time updates"
        actions={
          <TableToolbar
            onFilter={() => {}}
            exportItems={[
              { label: "Export as Excel", disabled: true },
              { label: "Export as CSV", disabled: true },
              { label: "Export as XML", disabled: true },
            ]}
          />
        }
        footer={
          <SmartPanelFooter
            left={
              <>
                <span>Showing 5 of 1,247 submissions</span>
                <span className="inline-flex items-center gap-2">
                  <AppIcon icon={Search} size="md" />
                  Real-time search &amp; filter
                </span>
              </>
            }
            right={
              <>
                <Badge variant="secondary" className="pill-badge border-success/20 bg-success/10 text-success">
                  <AppIcon icon={BarChart3} size="xs" />
                  SQL Queries
                </Badge>
                <Badge variant="secondary" className="pill-badge border-info/20 bg-info/10 text-info">
                  <AppIcon icon={TrendingUp} size="xs" />
                  Live Updates
                </Badge>
                <Badge variant="secondary" className="pill-badge border-accent/20 bg-accent/10 text-accent">
                  <AppIcon icon={RefreshCw} size="xs" />
                  Auto-refresh
                </Badge>
              </>
            }
          />
        }
      >
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="smart-table-head grid grid-cols-12 gap-4 border-b border-border/60 px-4 py-3.5">
              <div className="col-span-1 flex items-center gap-2">
                <input type="checkbox" className="rounded border-border" aria-label="Select all" />
                ID
              </div>
              <div className="col-span-3 flex items-center gap-2">
                <AppIcon icon={User} size="md" className="text-primary" />
                User Details
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <AppIcon icon={Building} size="md" className="text-info" />
                Company
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <AppIcon icon={Calendar} size="md" className="text-accent" />
                Submitted
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <AppIcon icon={CheckCircle} size="md" className="text-success" />
                Status
              </div>
              <div className="col-span-1 flex items-center gap-2">
                <AppIcon icon={Star} size="md" className="text-warning" />
                Rating
              </div>
              <div className="col-span-1 text-center">Actions</div>
            </div>

            <div className="divide-y divide-border/60">
              {sampleData.map((row) => (
                <div key={row.id} className="smart-table-row grid grid-cols-12 gap-4 px-4 py-4">
                  <div className="col-span-1 flex items-center gap-2">
                    <input type="checkbox" className="rounded border-border" aria-label={`Select ${row.name}`} />
                    <span className="font-mono text-xs text-muted-foreground">#{row.id}</span>
                  </div>

                  <div className="col-span-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <InitialsAvatar name={row.name} email={row.email} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground truncate">{row.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                          <AppIcon icon={Mail} size="xs" />
                          {row.email}
                        </div>
                        <div className="text-xs text-muted-foreground">{row.position}</div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 min-w-0">
                    <div className="font-medium truncate">{row.company}</div>
                    <div className="text-sm text-muted-foreground">{row.department}</div>
                    <Badge variant="outline" className="mt-1.5 text-xs font-normal">
                      {row.formType}
                    </Badge>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm font-medium">{row.submittedAt.split(" ")[0]}</div>
                    <div className="text-xs text-muted-foreground">{row.submittedAt.split(" ")[1]}</div>
                  </div>

                  <div className="col-span-2 flex items-center">
                    <StatusBadge status={statusMap[row.status]} label={row.status === "review" ? "In Review" : undefined} />
                  </div>

                  <div className="col-span-1 flex items-center">
                    <RatingStars rating={row.rating} />
                  </div>

                  <div className="col-span-1 flex items-center justify-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 hover:bg-primary/10 hover:text-primary">
                          <AppIcon icon={MoreHorizontal} size="md" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="cursor-pointer">
                          <AppIcon icon={Eye} size="md" className="mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer">
                          <AppIcon icon={Pencil} size="md" className="mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
                          <AppIcon icon={Trash2} size="md" className="mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SmartPanel>
    </section>
  );
}
