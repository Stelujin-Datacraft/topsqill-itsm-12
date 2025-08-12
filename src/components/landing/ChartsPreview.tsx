import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from "recharts";

const data = [
  { name: "Mon", submissions: 120, conversions: 45, errors: 2 },
  { name: "Tue", submissions: 220, conversions: 88, errors: 3 },
  { name: "Wed", submissions: 180, conversions: 70, errors: 1 },
  { name: "Thu", submissions: 260, conversions: 110, errors: 4 },
  { name: "Fri", submissions: 310, conversions: 140, errors: 2 },
  { name: "Sat", submissions: 150, conversions: 60, errors: 1 },
  { name: "Sun", submissions: 90, conversions: 32, errors: 0 },
];

export default function ChartsPreview() {
  return (
    <section aria-labelledby="charts-preview-heading" className="container mx-auto px-4">
      <Card className="overflow-hidden group hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5 group-hover:from-blue-50 group-hover:to-purple-50 transition-all duration-500">
          <CardTitle id="charts-preview-heading" className="text-2xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-500">
            Real-time Analytics Dashboard
          </CardTitle>
          <CardDescription className="text-lg group-hover:text-foreground transition-colors duration-500">
            Beautiful charts showing submissions, conversions, and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 group-hover:bg-gradient-to-br group-hover:from-blue-50/30 group-hover:to-purple-50/30 transition-all duration-500">
          <div className="h-64 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" className="group-hover:stroke-blue-300 transition-colors duration-500" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" className="group-hover:stroke-blue-600 transition-colors duration-500" />
                <YAxis stroke="hsl(var(--muted-foreground))" className="group-hover:stroke-blue-600 transition-colors duration-500" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="submissions" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#1d4ed8' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="conversions" 
                  stroke="#8b5cf6" 
                  strokeWidth={3} 
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#7c3aed' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-64 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-cyan-400/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSub" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" className="group-hover:stroke-emerald-300 transition-colors duration-500" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" className="group-hover:stroke-emerald-600 transition-colors duration-500" />
                <YAxis stroke="hsl(var(--muted-foreground))" className="group-hover:stroke-emerald-600 transition-colors duration-500" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)'
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="submissions" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSub)" />
                <Area type="monotone" dataKey="conversions" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorConv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
        <div className="p-6 bg-muted/30 group-hover:bg-gradient-to-r group-hover:from-blue-50 group-hover:to-purple-50 transition-all duration-500">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="group-hover:scale-105 transition-transform duration-300">
              <Badge variant="secondary" className="mb-2 bg-blue-100 text-blue-700 group-hover:bg-blue-200 group-hover:scale-110 transition-all duration-300">Live Data</Badge>
              <p className="text-sm text-muted-foreground">Real-time submission tracking</p>
            </div>
            <div className="group-hover:scale-105 transition-transform duration-300">
              <Badge variant="secondary" className="mb-2 bg-purple-100 text-purple-700 group-hover:bg-purple-200 group-hover:scale-110 transition-all duration-300">Insights</Badge>
              <p className="text-sm text-muted-foreground">AI-powered analytics</p>
            </div>
            <div className="group-hover:scale-105 transition-transform duration-300">
              <Badge variant="secondary" className="mb-2 bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 group-hover:scale-110 transition-all duration-300">Conversion</Badge>
              <p className="text-sm text-muted-foreground">Smart optimization tips</p>
            </div>
            <div className="group-hover:scale-105 transition-transform duration-300">
              <Badge variant="secondary" className="mb-2 bg-cyan-100 text-cyan-700 group-hover:bg-cyan-200 group-hover:scale-110 transition-all duration-300">Export</Badge>
              <p className="text-sm text-muted-foreground">Multiple formats supported</p>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
