'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { completeShopOAuthConnection } from '../actions/createShop';

interface CreateShopFromURLProps {
  onShopCreated?: () => void;
  searchParams?: {
    showCreateShop?: string;
    platform?: string;
    accessToken?: string;
    domain?: string;
    refreshToken?: string;
    tokenExpiresAt?: string;
  };
}

export function CreateShopFromURL({ onShopCreated, searchParams }: CreateShopFromURLProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!searchParams?.showCreateShop) return;
    const urlDomain = searchParams.domain;
    if (!urlDomain || !searchParams.platform) return;

    const decodedDomain = decodeURIComponent(urlDomain);
    const domainName = decodedDomain.replace(/^https?:\/\//, '').split('.')[0].replace(/[-_]/g, ' ');
    setName(`${domainName.charAt(0).toUpperCase()}${domainName.slice(1)} Store`);
    setDomain(decodedDomain);
    setIsDialogOpen(true);
  }, [searchParams]);

  const handleShopCreation = async () => {
    if (!name.trim() || !domain.trim()) {
      toast.error('OAuth shop details are incomplete');
      return;
    }

    setIsLoading(true);
    try {
      const result = await completeShopOAuthConnection(name.trim());
      if (!result.success) {
        toast.error(result.error || 'Failed to create shop');
        return;
      }

      toast.success('Shop connected successfully!');
      setIsDialogOpen(false);
      const url = new URL(window.location.href);
      ['showCreateShop', 'platform', 'accessToken', 'domain', 'refreshToken', 'tokenExpiresAt'].forEach(
        (parameter) => url.searchParams.delete(parameter)
      );
      router.replace(url.pathname + url.search);
      await queryClient.invalidateQueries({ queryKey: ['lists', 'Shop', 'items'] });
      onShopCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create shop');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Openfront Store</DialogTitle>
          <DialogDescription>Complete your shop setup with the OAuth credentials received.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Shop Name</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} disabled={isLoading} />
          </div>
          <div>
            <Label htmlFor="domain">Domain</Label>
            <Input id="domain" value={domain} onChange={(event) => setDomain(event.target.value)} disabled={isLoading} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleShopCreation} disabled={isLoading}>{isLoading ? 'Connecting...' : 'Connect Store'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
