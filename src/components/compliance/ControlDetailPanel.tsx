import React, { useState } from 'react';
import { Plus, Trash2, FileText, FlaskConical, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useControlMappings } from '@/hooks/useCompliance';
import { useControlTests } from '@/hooks/useEvidence';
import { usePolicies } from '@/hooks/usePolicies';
import { useAuth } from '@/contexts/AuthContext';
import { TEST_RESULTS, IMPLEMENTATION_STATUSES } from '@/types/compliance';
import type { ComplianceControl } from '@/types/compliance';
import { format } from 'date-fns';

interface ControlDetailPanelProps {
  control: ComplianceControl;
  open: boolean;
  onClose: () => void;
}

const ControlDetailPanel = ({ control, open, onClose }: ControlDetailPanelProps) => {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const { policies } = usePolicies();
  const { mappings: controlMappings, createMapping, deleteMapping } = useControlMappings(control.id);
  const { tests, createTest, updateTest, deleteTest } = useControlTests(control.id);

  const [showAddMapping, setShowAddMapping] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [mappingNotes, setMappingNotes] = useState('');
  const [coverageStatus, setCoverageStatus] = useState('partial');

  const [showAddTest, setShowAddTest] = useState(false);
  const [testForm, setTestForm] = useState({
    test_name: '', test_description: '', test_type: 'manual',
    test_procedure: '', expected_result: '', actual_result: '',
    test_result: 'not_tested', notes: ''
  });

  const resetTestForm = () => setTestForm({
    test_name: '', test_description: '', test_type: 'manual',
    test_procedure: '', expected_result: '', actual_result: '',
    test_result: 'not_tested', notes: ''
  });

  const mappedPolicyIds = controlMappings.map(m => m.policy_id);
  const availablePolicies = policies.filter(p => !mappedPolicyIds.includes(p.id));
  const statusDef = IMPLEMENTATION_STATUSES.find(s => s.value === control.implementation_status);

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{control.control_id_ref}</span>
            {control.title}
          </SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={statusDef?.color || ''}>{statusDef?.label}</Badge>
            {control.category && <Badge variant="secondary">{control.category}</Badge>}
            <Badge variant="outline">{control.risk_level} risk</Badge>
          </div>
          {control.description && <p className="text-sm text-muted-foreground">{control.description}</p>}
        </SheetHeader>

        <Tabs defaultValue="mappings" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="mappings" className="flex-1 gap-1"><Link2 className="h-3.5 w-3.5" /> Mappings ({controlMappings.length})</TabsTrigger>
            <TabsTrigger value="tests" className="flex-1 gap-1"><FlaskConical className="h-3.5 w-3.5" /> Tests ({tests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="mappings" className="space-y-3 mt-4">
            {isAdmin && availablePolicies.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowAddMapping(true)} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Map Policy
              </Button>
            )}
            {controlMappings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No policies mapped to this control.</p>
            ) : (
              controlMappings.map(mapping => {
                const policy = policies.find(p => p.id === mapping.policy_id);
                return (
                  <Card key={mapping.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{policy?.name || 'Unknown Policy'}</div>
                          {mapping.mapping_notes && <p className="text-xs text-muted-foreground">{mapping.mapping_notes}</p>}
                        </div>
                        <Badge variant={mapping.coverage_status === 'full' ? 'default' : 'secondary'} className="text-xs">
                          {mapping.coverage_status}
                        </Badge>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMapping.mutate(mapping.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="tests" className="space-y-3 mt-4">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => { resetTestForm(); setShowAddTest(true); }} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Test
              </Button>
            )}
            {tests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No tests recorded for this control.</p>
            ) : (
              tests.map(test => {
                const resultDef = TEST_RESULTS.find(r => r.value === test.test_result);
                return (
                  <Card key={test.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FlaskConical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{test.test_name}</span>
                          <Badge className={resultDef?.color || ''} variant="outline">{resultDef?.label}</Badge>
                          <Badge variant="secondary" className="text-xs">{test.test_type}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {isAdmin && (
                            <Select value={test.test_result} onValueChange={v => updateTest.mutate({ id: test.id, test_result: v })}>
                              <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{TEST_RESULTS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTest.mutate(test.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {test.test_description && <p className="text-xs text-muted-foreground ml-6">{test.test_description}</p>}
                      {test.actual_result && <p className="text-xs text-muted-foreground ml-6 mt-1"><strong>Result:</strong> {test.actual_result}</p>}
                      {test.tested_at && <p className="text-xs text-muted-foreground ml-6">Tested: {format(new Date(test.tested_at), 'MMM d, yyyy')}</p>}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        {/* Add Policy Mapping Dialog */}
        <Dialog open={showAddMapping} onOpenChange={setShowAddMapping}>
          <DialogContent>
            <DialogHeader><DialogTitle>Map Policy to Control</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Policy *</Label>
                <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                  <SelectTrigger><SelectValue placeholder="Select a policy..." /></SelectTrigger>
                  <SelectContent>
                    {availablePolicies.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.policy_number ? `${p.policy_number} - ` : ''}{p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Coverage Status</Label>
                <Select value={coverageStatus} onValueChange={setCoverageStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Coverage</SelectItem>
                    <SelectItem value="partial">Partial Coverage</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={mappingNotes} onChange={e => setMappingNotes(e.target.value)} rows={2} placeholder="How does this policy address the control?" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddMapping(false)}>Cancel</Button>
              <Button disabled={!selectedPolicyId} onClick={() => {
                createMapping.mutate({
                  policy_id: selectedPolicyId,
                  control_id: control.id,
                  mapping_notes: mappingNotes || undefined,
                  coverage_status: coverageStatus,
                } as any);
                setShowAddMapping(false);
                setSelectedPolicyId('');
                setMappingNotes('');
                setCoverageStatus('partial');
              }}>Map Policy</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Test Dialog */}
        <Dialog open={showAddTest} onOpenChange={setShowAddTest}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Control Test</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Test Name *</Label><Input value={testForm.test_name} onChange={e => setTestForm(f => ({ ...f, test_name: e.target.value }))} placeholder="e.g., Access Review Q1" /></div>
              <div><Label>Description</Label><Textarea value={testForm.test_description} onChange={e => setTestForm(f => ({ ...f, test_description: e.target.value }))} rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Test Type</Label>
                  <Select value={testForm.test_type} onValueChange={v => setTestForm(f => ({ ...f, test_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="automated">Automated</SelectItem>
                      <SelectItem value="walkthrough">Walkthrough</SelectItem>
                      <SelectItem value="inquiry">Inquiry</SelectItem>
                      <SelectItem value="observation">Observation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Result</Label>
                  <Select value={testForm.test_result} onValueChange={v => setTestForm(f => ({ ...f, test_result: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TEST_RESULTS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Procedure</Label><Textarea value={testForm.test_procedure} onChange={e => setTestForm(f => ({ ...f, test_procedure: e.target.value }))} rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Expected Result</Label><Input value={testForm.expected_result} onChange={e => setTestForm(f => ({ ...f, expected_result: e.target.value }))} /></div>
                <div><Label>Actual Result</Label><Input value={testForm.actual_result} onChange={e => setTestForm(f => ({ ...f, actual_result: e.target.value }))} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={testForm.notes} onChange={e => setTestForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddTest(false)}>Cancel</Button>
              <Button disabled={!testForm.test_name.trim()} onClick={() => {
                createTest.mutate({
                  ...testForm,
                  tested_at: new Date().toISOString(),
                } as any);
                setShowAddTest(false);
                resetTestForm();
              }}>Add Test</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
};

export default ControlDetailPanel;
