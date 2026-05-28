'use client';

import HotelForm from './forms/hotel-form';
import FlightForm from './forms/flight-form';
import VehicleForm from './forms/vehicle-form';

interface StepItemDetailsProps {
  itemType: 'hotel' | 'flight' | 'vehicle';
  itemData: Record<string, unknown>;
  costPrice: number;
  sellPrice: number;
  notes: string;
  onItemDataChange: (data: Record<string, unknown>) => void;
  onCostPriceChange: (price: number) => void;
  onSellPriceChange: (price: number) => void;
  onNotesChange: (notes: string) => void;
}

export default function StepItemDetails({
  itemType,
  itemData,
  costPrice,
  sellPrice,
  notes,
  onItemDataChange,
  onCostPriceChange,
  onSellPriceChange,
  onNotesChange,
}: StepItemDetailsProps) {
  return (
    <div className="space-y-6">
      {itemType === 'hotel' && (
        <HotelForm
          itemData={itemData}
          costPrice={costPrice}
          sellPrice={sellPrice}
          notes={notes}
          onItemDataChange={onItemDataChange}
          onCostPriceChange={onCostPriceChange}
          onSellPriceChange={onSellPriceChange}
          onNotesChange={onNotesChange}
        />
      )}

      {itemType === 'flight' && (
        <FlightForm
          itemData={itemData}
          costPrice={costPrice}
          sellPrice={sellPrice}
          notes={notes}
          onItemDataChange={onItemDataChange}
          onCostPriceChange={onCostPriceChange}
          onSellPriceChange={onSellPriceChange}
          onNotesChange={onNotesChange}
        />
      )}

      {itemType === 'vehicle' && (
        <VehicleForm
          itemData={itemData}
          costPrice={costPrice}
          sellPrice={sellPrice}
          notes={notes}
          onItemDataChange={onItemDataChange}
          onCostPriceChange={onCostPriceChange}
          onSellPriceChange={onSellPriceChange}
          onNotesChange={onNotesChange}
        />
      )}
    </div>
  );
}
