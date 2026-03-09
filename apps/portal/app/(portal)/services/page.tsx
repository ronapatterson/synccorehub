import { headers } from "next/headers";
import { db } from "@synccorehub/database/client";
import { products } from "@synccorehub/database/schema";
import { and, eq, isNull } from "drizzle-orm";
import { Badge } from "@synccorehub/ui";
import { Package, ShoppingBag, ArrowRight } from "lucide-react";

export default async function PortalServicesPage() {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id");

  const availableProducts = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId!),
        eq(products.showInPortal, true),
        eq(products.status, "active"),
        isNull(products.deletedAt),
      ),
    )
    .orderBy(products.name);

  const productsByType = availableProducts.reduce(
    (acc, product) => {
      const key = product.productType;
      if (!acc[key]) acc[key] = [];
      acc[key].push(product);
      return acc;
    },
    {} as Record<string, typeof availableProducts>,
  );

  const TYPE_LABELS: Record<string, string> = {
    service: "Services",
    product: "Products",
    subscription: "Subscriptions",
    addon: "Add-ons",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Services & Products</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Explore additional offerings available to you.
        </p>
      </div>

      {availableProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="font-medium">No services available</p>
          <p className="text-sm text-muted-foreground mt-1">
            Check back later for offerings from your provider.
          </p>
        </div>
      ) : (
        Object.entries(productsByType).map(([type, items]) => (
          <section key={type}>
            <h2 className="font-semibold text-lg mb-4">{TYPE_LABELS[type] ?? type}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((product) => (
                <div
                  key={product.id}
                  className="bg-card border rounded-xl p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <Badge variant="secondary" className="text-xs capitalize mt-0.5">
                          {TYPE_LABELS[product.productType] ?? product.productType}
                        </Badge>
                      </div>
                    </div>
                    {product.priceCents !== null && (
                      <p className="font-semibold text-sm shrink-0">
                        {product.priceCents === 0
                          ? "Free"
                          : `$${(product.priceCents / 100).toFixed(2)}`}
                        {product.productType === "subscription" && (
                          <span className="text-xs text-muted-foreground font-normal">/mo</span>
                        )}
                      </p>
                    )}
                  </div>

                  {product.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {product.description}
                    </p>
                  )}

                  <div className="mt-auto pt-1">
                    <button className="w-full flex items-center justify-center gap-1.5 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 py-2 rounded-lg transition-colors">
                      Learn more <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
