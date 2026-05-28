'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hotel, Plane, Truck } from 'lucide-react';

interface StepItemTypeSelectProps {
  selectedType: 'hotel' | 'flight' | 'vehicle' | null;
  onSelect: (type: 'hotel' | 'flight' | 'vehicle') => void;
}

export default function StepItemTypeSelect({ selectedType, onSelect }: StepItemTypeSelectProps) {
  const options = [
    {
      id: 'hotel',
      label: 'Hotel',
      description: 'Accommodation booking',
      icon: Hotel,
    },
    {
      id: 'flight',
      label: 'Flight',
      description: 'Flight ticket booking',
      icon: Plane,
    },
    {
      id: 'vehicle',
      label: 'Vehicle',
      description: 'Car rental or transfer',
      icon: Truck,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">What are you booking?</h2>
        <p className="text-sm text-muted-foreground">
          Select the type of item you want to create a booking for
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id as 'hotel' | 'flight' | 'vehicle')}
              className={`text-left transition-all ${
                isSelected
                  ? 'ring-2 ring-blue-500 border-blue-200'
                  : 'border border-border hover:border-foreground/50'
              }`}
            >
              <Card className={isSelected ? 'border-blue-200 bg-blue-50' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{option.label}</CardTitle>
                      <CardDescription>{option.description}</CardDescription>
                    </div>
                    <Icon className={`h-6 w-6 ${isSelected ? 'text-blue-600' : 'text-muted-foreground'}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className={`inline-block h-3 w-3 rounded-full border-2 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-muted-foreground bg-transparent'
                    }`}
                  />
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
