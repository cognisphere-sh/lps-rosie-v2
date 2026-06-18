import { SupplierWorkspaceView } from "@/components/supplier/supplier-workspace-view";
import { V2Header } from "@/components/supplier/ui";
import { SUPPLIER } from "@/components/supplier/supplier";

export default function SellerPage() {
  return (
    <>
      <V2Header
        title={SUPPLIER.name}
        subtitle={SUPPLIER.tier}
        backHref="/"
        backLabel="Home"
      />
      <SupplierWorkspaceView />
    </>
  );
}
