'use client';
import React, { useState, useId } from 'react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, ChevronLeft, ChevronRight, Plus, Loader2, Check, X, Send } from 'lucide-react';
import { searchChannelProducts } from '../actions/orders';
import { useToast } from '@/components/ui/use-toast';

interface Channel {
  id: string;
  name: string;
}

interface Product {
  image?: string;
  title: string;
  productId: string;
  variantId: string;
  price: string;
  quantity?: number;
  lineItemId?: string;
}

interface SourceLine {
  id: string;
  lineItemId?: string;
  name: string;
  quantity?: number;
}

interface ChannelSearchAccordionProps {
  channels: Channel[];
  lineItems: SourceLine[];
  onAddItem: (product: Product, channelId: string, orderId: string) => Promise<unknown> | unknown;
  orderId: string;
}

export const ChannelSearchAccordion: React.FC<ChannelSearchAccordionProps> = ({
  channels,
  lineItems,
  onAddItem,
  orderId,
}) => {
  const [searchEntry, setSearchEntry] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedSourceLineId, setSelectedSourceLineId] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const inputId = useId();
  // Track add status for each product: 'idle' | 'loading' | 'success' | 'error'
  const [addStatus, setAddStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
  const routableLines = (lineItems || []).filter((item) => item.lineItemId);
  const productKey = (product: Product) => `${product.productId}:${product.variantId}`;

  const handleSearch = async () => {
    if (!selectedChannelId || !searchEntry) {
      toast({
        title: 'Missing Information',
        description: 'Please select a channel and enter a search term.',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      const results = await searchChannelProducts(selectedChannelId, searchEntry);
      // Handle both array and object with products property
      let products: Product[] = [];
      if (Array.isArray(results)) {
        products = results;
      } else if (results && Array.isArray(results.products)) {
        products = results.products;
      }
      setSearchResults(products);
    } catch (error: any) {
      toast({
        title: 'Search Failed',
        description: error.message,
        variant: 'destructive',
      });
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (key: string, newQuantity: number) => {
    setQuantities({ ...quantities, [key]: Math.max(1, newQuantity) });
  };

  const handleAddItem = async (product: Product) => {
    const key = productKey(product);
    const sourceLineItemId = selectedSourceLineId ||
      (routableLines.length === 1 ? String(routableLines[0].lineItemId) : '');
    if (!sourceLineItemId) {
      toast({
        title: 'Select a source item',
        description: 'Choose the ordered line that this supplier item will fulfill.',
        variant: 'destructive',
      });
      return;
    }

    setAddStatus((prev) => ({ ...prev, [key]: 'loading' }));
    try {
      const quantity = quantities[key] || 1;
      const response: any = await onAddItem(
        { ...product, quantity, lineItemId: sourceLineItemId },
        selectedChannelId,
        orderId
      );
      if (response?.success === false) {
        throw new Error(response.error || 'The item could not be routed.');
      }
      setAddStatus((prev) => ({ ...prev, [key]: 'success' }));
      setQuantities({ ...quantities, [key]: 1 });
      setTimeout(() => {
        setAddStatus((prev) => ({ ...prev, [key]: 'idle' }));
      }, 1200);
    } catch (error) {
      toast({
        title: 'Unable to add supplier item',
        description: error instanceof Error ? error.message : 'The item could not be routed.',
        variant: 'destructive',
      });
      setAddStatus((prev) => ({ ...prev, [key]: 'error' }));
      setTimeout(() => {
        setAddStatus((prev) => ({ ...prev, [key]: 'idle' }));
      }, 1200);
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border-t border-b flex flex-col gap-2 py-3 px-4 md:px-6 bg-emerald-50/40 dark:bg-emerald-900/20"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center rounded-sm shadow-sm uppercase tracking-wide border max-w-fit gap-2 text-nowrap pl-2.5 pr-1 py-[3px] text-sm font-medium text-emerald-500 bg-white border-emerald-200 hover:bg-emerald-100 hover:text-emerald-700 focus:z-10 focus:ring-2 focus:ring-emerald-700 focus:text-emerald-700 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-300 dark:hover:text-white dark:hover:bg-emerald-700 dark:focus:ring-emerald-500 dark:focus:text-white"
        >
          Channel Search
          <ChevronsUpDown className="h-4 w-4" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2">
        <div className="space-y-2">
          <div className="flex rounded-md shadow-xs">
            <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
              <SelectTrigger className="w-fit rounded-e-none shadow-none text-muted-foreground hover:text-foreground">
                <SelectValue placeholder="Select Channel" />
              </SelectTrigger>
              <SelectContent>
                {(channels || []).map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {routableLines.length > 1 && (
              <Select value={selectedSourceLineId} onValueChange={setSelectedSourceLineId}>
                <SelectTrigger className="w-fit -ms-px rounded-none shadow-none text-muted-foreground hover:text-foreground">
                  <SelectValue placeholder="Source item" />
                </SelectTrigger>
                <SelectContent>
                  {routableLines.map((line) => (
                    <SelectItem key={line.id} value={String(line.lineItemId)}>
                      {line.name} × {line.quantity || 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="relative flex-1">
              <Input
                id={inputId}
                className="-ms-px rounded-s-none shadow-none focus-visible:z-10 flex-1 bg-white pe-10"
                placeholder="Search channel products..."
                value={searchEntry}
                onChange={(e) => setSearchEntry(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Search"
                onClick={handleSearch}
                disabled={loading}
                type="button"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>
        {searchResults.length > 0 ? (
          <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
            {searchResults.map((product) => {
              const key = productKey(product);
              return (
              <div
                key={key}
                className="flex items-center space-x-2 p-2 bg-background rounded-md border"
              >
                <div className="w-12 h-12 flex-shrink-0 rounded-md overflow-hidden">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="border rounded-sm h-12 w-12 bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">IMG</span>
                    </div>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="text-sm font-medium truncate">
                    {product.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {product.productId} | {product.variantId}
                  </div>
                  <p className="text-sm dark:text-emerald-500 font-medium">
                    ${parseFloat(product.price).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleQuantityChange(key, (quantities[key] || 1) - 1)}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Input
                      className="mx-1 border rounded-md h-6 w-10 text-center bg-background"
                      type="text"
                      value={quantities[key] || 1}
                      onChange={(e) => handleQuantityChange(key, parseInt(e.target.value, 10))}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleQuantityChange(key, (quantities[key] || 1) + 1)}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleAddItem(product)}
                    disabled={addStatus[key] === 'loading'}
                  >
                    {addStatus[key] === 'loading' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : addStatus[key] === 'success' ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : addStatus[key] === 'error' ? (
                      <X className="h-3 w-3 text-red-600" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        ) : !loading && (
          <div className="text-center text-muted-foreground py-4">
            No products found for this channel.
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};