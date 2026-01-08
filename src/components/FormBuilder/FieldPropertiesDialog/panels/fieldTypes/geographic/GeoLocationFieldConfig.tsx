import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface GeoLocationFieldConfigProps {
  config: any;
  onUpdate: (updates: any) => void;
  errors?: Record<string, string>;
}

export function GeoLocationFieldConfig({ config, onUpdate, errors }: GeoLocationFieldConfigProps) {
  const customConfig = config.customConfig || {};

  const handleConfigChange = (key: string, value: any) => {
    onUpdate({
      customConfig: {
        ...customConfig,
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Geo-Location Configuration</h3>
        
        <div className="space-y-2">
          <Label htmlFor="inputMethod">Location Input Method</Label>
          <Select
            value={customConfig.inputMethod || 'gps'}
            onValueChange={(value) => handleConfigChange('inputMethod', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select input method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gps">GPS Current Location</SelectItem>
              <SelectItem value="map">Map Pin Selection</SelectItem>
              <SelectItem value="coordinates">Manual Coordinates</SelectItem>
              <SelectItem value="all">All Methods Available</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultLocation">Default Location (lat, lng)</Label>
          <Input
            id="defaultLocation"
            value={customConfig.defaultLocation || ''}
            onChange={(e) => handleConfigChange('defaultLocation', e.target.value)}
            placeholder="40.7128, -74.0060"
          />
          <p className="text-sm text-muted-foreground">
            Default coordinates to show on map (latitude, longitude)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="zoomLevel">Default Zoom Level</Label>
          <Input
            id="zoomLevel"
            type="number"
            min="1"
            max="20"
            value={customConfig.zoomLevel || 13}
            onChange={(e) => handleConfigChange('zoomLevel', parseInt(e.target.value) || 13)}
            placeholder="13"
          />
          <p className="text-sm text-muted-foreground">
            Map zoom level (1 = world view, 20 = street level)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="accuracy">Required Accuracy (meters)</Label>
          <Input
            id="accuracy"
            type="number"
            min="1"
            value={customConfig.requiredAccuracy || 100}
            onChange={(e) => handleConfigChange('requiredAccuracy', parseInt(e.target.value) || 100)}
            placeholder="100"
          />
          <p className="text-sm text-muted-foreground">
            Maximum allowed GPS accuracy in meters
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowManualEntry"
            checked={customConfig.allowManualEntry !== false}
            onCheckedChange={(checked) => handleConfigChange('allowManualEntry', checked)}
          />
          <Label htmlFor="allowManualEntry">Allow manual coordinate entry</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showAddress"
            checked={customConfig.showAddress !== false}
            onCheckedChange={(checked) => handleConfigChange('showAddress', checked)}
          />
          <Label htmlFor="showAddress">Show reverse geocoded address</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="trackMovement"
            checked={customConfig.trackMovement || false}
            onCheckedChange={(checked) => handleConfigChange('trackMovement', checked)}
          />
          <Label htmlFor="trackMovement">Track location changes</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="mapOnly"
            checked={customConfig.mapOnly || false}
            onCheckedChange={(checked) => handleConfigChange('mapOnly', checked)}
          />
          <Label htmlFor="mapOnly">Map view only (no GPS option)</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mapProvider">Map Provider</Label>
          <Select
            value={customConfig.mapProvider || 'openstreetmap'}
            onValueChange={(value) => handleConfigChange('mapProvider', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select map provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openstreetmap">OpenStreetMap</SelectItem>
              <SelectItem value="google">Google Maps</SelectItem>
              <SelectItem value="mapbox">Mapbox</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}