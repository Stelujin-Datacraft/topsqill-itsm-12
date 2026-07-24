import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  User, Mail, Building, Calendar, Star, CheckCircle, 
  AlertCircle, Clock, Download, Filter, Search, MoreHorizontal,
  FileSpreadsheet, FileText, FileCode, Eye, Pencil, Trash2
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
    status: "approved",
    rating: 5,
    formType: "Employee Feedback"
  },
  {
    id: "002", 
    name: "Michael Chen",
    email: "m.chen@startupxyz.io",
    company: "StartupXYZ",
    department: "Product",
    position: "Product Manager",
    submittedAt: "2025-01-12 11:15",
    status: "pending",
    rating: 4,
    formType: "Feature Request"
  },
  {
    id: "003",
    name: "Elena Rodriguez",
    email: "elena.r@globalsolutions.com",
    company: "Global Solutions Ltd",
    department: "Marketing",
    position: "Marketing Director",
    submittedAt: "2025-01-12 09:45",
    status: "review",
    rating: 5,
    formType: "Partnership Inquiry"
  },
  {
    id: "004",
    name: "David Kim",
    email: "david.kim@innovate.co",
    company: "Innovate Co",
    department: "Sales",
    position: "Account Executive",
    submittedAt: "2025-01-11 16:20",
    status: "approved",
    rating: 3,
    formType: "Customer Onboarding"
  },
  {
    id: "005",
    name: "Amanda Foster",
    email: "a.foster@enterprises.com",
    company: "Enterprise Solutions",
    department: "HR",
    position: "HR Manager",
    submittedAt: "2025-01-11 13:55",
    status: "rejected",
    rating: 2,
    formType: "Vendor Application"
  }
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "approved": return <CheckCircle className="icon-md text-success" />;
    case "pending": return <Clock className="icon-md text-amber-600" />;
    case "review": return <AlertCircle className="icon-md text-info" />;
    case "rejected": return <AlertCircle className="icon-md text-destructive" />;
    default: return <Clock className="icon-md text-gray-600" />;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "approved": return <Badge className="bg-success/10 text-success hover:bg-emerald-200">Approved</Badge>;
    case "pending": return <Badge className="bg-warning/10 text-warning hover:bg-amber-200">Pending</Badge>;
    case "review": return <Badge className="bg-info/10 text-info hover:bg-blue-200">In Review</Badge>;
    case "rejected": return <Badge className="bg-destructive/10 text-destructive hover:bg-red-200">Rejected</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

const getRatingStars = (rating: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <Star 
      key={i} 
      className={`h-3 w-3 ${i < rating ? 'text-warning fill-warning' : 'text-muted-foreground/40'}`} 
    />
  ));
};

export default function DataTablePreview() {
  return (
    <section aria-labelledby="table-preview-heading" className="container mx-auto px-4">
      <Card className="overflow-hidden group hover:shadow-token-lg transition-all duration-500">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-cyan-50 group-hover:from-emerald-100 group-hover:to-cyan-100 transition-all duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle id="table-preview-heading" className="text-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent group-hover:from-emerald-700 group-hover:to-cyan-700 transition-all duration-500">
                Smart Data Tables
              </CardTitle>
              <CardDescription className="text-lg group-hover:text-foreground transition-colors duration-500">
                Powerful data visualization with filtering, sorting, and real-time updates
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="hover:bg-emerald-100 hover:border-emerald-400 hover:text-success transition-all duration-300">
                <Filter className="icon-md mr-2 text-module-forms" />
                Filter
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hover:bg-emerald-100 hover:border-emerald-400 hover:text-success transition-all duration-300">
                    <Download className="icon-md mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
                    <FileSpreadsheet className="icon-md mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
                    <FileText className="icon-md mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
                    <FileCode className="icon-md mr-2" />
                    Export as XML
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 group-hover:bg-gradient-to-br group-hover:from-emerald-50/30 group-hover:to-cyan-50/30 transition-all duration-500">
          {/* Scrollable Table Area */}
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 border-b font-medium text-sm group-hover:bg-emerald-50/50 transition-all duration-500">
                <div className="col-span-1 flex items-center gap-2">
                  <input type="checkbox" className="rounded border-border" />
                  ID
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <User className="icon-md text-success" />
                  User Details
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Building className="icon-md text-info" />
                  Company
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Calendar className="icon-md text-accent" />
                  Submitted
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <CheckCircle className="icon-md text-green-600" />
                  Status
                </div>
                <div className="col-span-1 flex items-center gap-2">
                  <Star className="icon-md text-yellow-600" />
                  Rating
                </div>
                <div className="col-span-1 text-center">Actions</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y">
                {sampleData.map((row, index) => (
                  <div 
                    key={row.id} 
                    className={`grid grid-cols-12 gap-4 p-4 hover:bg-gradient-to-r transition-all duration-300 group/row cursor-pointer ${
                      index % 2 === 0 
                        ? 'hover:from-emerald-50 hover:to-cyan-50' 
                        : 'hover:from-cyan-50 hover:to-emerald-50'
                    }`}
                  >
                    <div className="col-span-1 flex items-center gap-2">
                      <input type="checkbox" className="rounded border-border" />
                      <span className="font-mono text-xs text-muted-foreground group-hover/row:text-success transition-colors">
                        #{row.id}
                      </span>
                    </div>
                    
                    <div className="col-span-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center justify-center text-white text-sm font-semibold transition-transform duration-300">
                          {row.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground group-hover/row:text-success transition-colors">
                            {row.name}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1 group-hover/row:text-cyan-600 transition-colors">
                            <Mail className="icon-xs" />
                            {row.email}
                          </div>
                          <div className="text-xs text-muted-foreground">{row.position}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-span-2">
                      <div className="font-medium group-hover/row:text-info transition-colors">{row.company}</div>
                      <div className="text-sm text-muted-foreground">{row.department}</div>
                      <Badge variant="outline" className="mt-1 text-xs group-hover/row:border-blue-300 group-hover/row:text-info transition-all duration-300">
                        {row.formType}
                      </Badge>
                    </div>
                    
                    <div className="col-span-2">
                      <div className="text-sm font-medium">{row.submittedAt.split(' ')[0]}</div>
                      <div className="text-xs text-muted-foreground">{row.submittedAt.split(' ')[1]}</div>
                    </div>
                    
                    <div className="col-span-2 flex items-center gap-2">
                      {getStatusIcon(row.status)}
                      {getStatusBadge(row.status)}
                    </div>
                    
                    <div className="col-span-1 flex items-center">
                      <div className="flex gap-0.5 transition-transform duration-300">
                        {getRatingStars(row.rating)}
                      </div>
                    </div>
                    
                    <div className="col-span-1 flex items-center justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="size-8 p-0 hover:bg-emerald-100 hover:text-success"
                          >
                            <MoreHorizontal className="icon-md" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="cursor-pointer">
                            <Eye className="icon-md mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer">
                            <Pencil className="icon-md mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
                            <Trash2 className="icon-md mr-2" />
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

          {/* Table Footer */}
          <div className="p-4 border-t bg-muted/30 group-hover:bg-gradient-to-r group-hover:from-emerald-50/50 group-hover:to-cyan-50/50 transition-all duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-muted-foreground">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span>Showing 5 of 1,247 submissions</span>
                <div className="flex items-center gap-2">
                  <Search className="icon-md" />
                  <span>Real-time search &amp; filter</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-success/10 text-success group-hover:bg-emerald-200 group- transition-all duration-300">
                  📊 SQL Queries
                </Badge>
                <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 group-hover:bg-cyan-200 group- transition-all duration-300">
                  📈 Live Updates
                </Badge>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 group-hover:bg-purple-200 group- transition-all duration-300">
                  🔄 Auto-refresh
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
