import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowUpRight, MousePointer2, Boxes, Type, Mail, Hash, 
  Calendar, ChevronDown, FileText, Phone, Star, Trash2,
  Settings, Eye, Plus
} from "lucide-react";

const fieldTypes = [
  { type: "text", icon: Type, label: "Text", color: "bg-blue-100 text-blue-700" },
  { type: "email", icon: Mail, label: "Email", color: "bg-green-100 text-green-700" },
  { type: "number", icon: Hash, label: "Number", color: "bg-purple-100 text-purple-700" },
  { type: "date", icon: Calendar, label: "Date", color: "bg-orange-100 text-orange-700" },
  { type: "select", icon: ChevronDown, label: "Select", color: "bg-red-100 text-red-700" },
  { type: "file", icon: FileText, label: "File", color: "bg-yellow-100 text-yellow-700" },
  { type: "phone", icon: Phone, label: "Phone", color: "bg-indigo-100 text-indigo-700" },
  { type: "rating", icon: Star, label: "Rating", color: "bg-pink-100 text-pink-700" }
];

export default function FormBuilderMini() {
  const [canvasFields, setCanvasFields] = useState([
    { id: "1", type: "text", label: "Full Name", required: true, placeholder: "Enter your full name" },
    { id: "2", type: "email", label: "Email Address", required: true, placeholder: "your@email.com" },
    { id: "3", type: "select", label: "Department", required: false, options: ["Sales", "Support", "Marketing"], showConditional: true }
  ]);
  
  const [draggedField, setDraggedField] = useState<any>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, fieldType: any) => {
    setDraggedField(fieldType);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedField) {
      const newField = {
        id: Date.now().toString(),
        type: draggedField.type,
        label: `New ${draggedField.label}`,
        required: false,
        placeholder: `Enter ${draggedField.label.toLowerCase()}`
      };
      setCanvasFields([...canvasFields, newField]);
      setDraggedField(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeField = (id: string) => {
    setCanvasFields(canvasFields.filter(field => field.id !== id));
    setSelectedField(null);
  };

  const getFieldIcon = (type: string) => {
    const fieldType = fieldTypes.find(f => f.type === type);
    const Icon = fieldType?.icon || Type;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <section aria-labelledby="builder-mini-heading" className="container mx-auto px-4">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle id="builder-mini-heading" className="text-2xl text-foreground">
                Drag-and-Drop Form Builder
              </CardTitle>
              <CardDescription className="text-lg">
                Build complex forms with validation and conditional logic in minutes
              </CardDescription>
            </div>
            <Button className="bg-foreground text-background hover:bg-foreground/90">
              <Eye className="h-4 w-4 mr-2" />
              Preview Form
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-0 md:grid-cols-4 min-h-[400px]">
            {/* Field Palette */}
            <div className="border-r bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Boxes className="h-5 w-5 text-primary"/>
                <span className="font-semibold">Field Palette</span>
              </div>
              <div className="space-y-2">
                {fieldTypes.map((fieldType) => {
                  const Icon = fieldType.icon;
                  return (
                    <div
                      key={fieldType.type}
                      draggable
                      onDragStart={(e) => handleDragStart(e, fieldType)}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-background cursor-move hover:shadow-md hover:scale-105 transition-all duration-200 group"
                    >
                      <div className={`p-1 rounded ${fieldType.color} group-hover:scale-110 transition-transform`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="text-sm font-medium">{fieldType.label}</span>
                    </div>
                  );
                })}
              </div>
              <Button size="sm" variant="outline" className="w-full mt-4">
                <Plus className="h-3 w-3 mr-1" />
                Custom Field
              </Button>
            </div>

            {/* Form Canvas */}
            <div 
              ref={canvasRef}
              className="col-span-2 p-4 min-h-[400px] bg-gradient-to-br from-background to-muted/10"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-muted-foreground">Form Canvas</span>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {canvasFields.length} fields
                </Badge>
              </div>
              
              <div className="space-y-3">
                {canvasFields.map((field) => (
                  <div 
                    key={field.id}
                    className={`group relative rounded-lg border bg-background p-4 transition-all duration-200 hover:shadow-md hover:border-primary/50 ${
                      selectedField === field.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedField(field.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getFieldIcon(field.type)}
                          <span className="font-medium">{field.label}</span>
                          {field.required && <span className="text-red-500 text-xs">*</span>}
                        </div>
                        <Input 
                          placeholder={field.placeholder}
                          className="text-sm"
                          disabled
                        />
                        <div className="text-xs text-muted-foreground mt-1 capitalize">
                          {field.type} {field.required ? '• required' : '• optional'}
                          {field.showConditional && ' • shows conditional fields'}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Settings className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeField(field.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {canvasFields.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Boxes className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Drag fields from the palette to start building your form</p>
                  </div>
                )}
              </div>
            </div>

            {/* Properties Panel */}
            <div className="border-l bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-primary"/>
                <span className="font-semibold">Properties</span>
              </div>
              
              {selectedField ? (
                <div className="space-y-4" key={selectedField}>
                  <div>
                    <label className="text-sm font-medium">Field Label</label>
                    <Input className="mt-1" value={canvasFields.find(f => f.id === selectedField)?.label || ''} readOnly />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Placeholder</label>
                    <Input className="mt-1" value={canvasFields.find(f => f.id === selectedField)?.placeholder || ''} readOnly />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`required-${selectedField}`} checked={canvasFields.find(f => f.id === selectedField)?.required || false} readOnly />
                    <label htmlFor={`required-${selectedField}`} className="text-sm">Required field</label>
                  </div>
                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Validation Rules</span>
                    <div className="mt-2 space-y-2">
                      <Badge variant="outline" className="text-xs">Email format</Badge>
                      <Badge variant="outline" className="text-xs">Min length: 3</Badge>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a field to edit its properties</p>
              )}
            </div>
          </div>
          
          <div className="border-t bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>✨ Smart validation</span>
                <span>🔄 Conditional logic</span>
                <span>📱 Mobile responsive</span>
                <span>🌐 Multi-language</span>
              </div>
              <Button variant="outline" size="sm">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Advanced Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
