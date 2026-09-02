import { useState } from "react";
import { productService } from "@/services/api/products";
import { GrindType } from "@/services/api/products/types";
import { ApiError } from "@/lib/api/types";

export type ProductForm = {
  title: string;
  description: string;
  roastLevel: string;
  grindType: "WHOLE" | "GROUND";
  price: number | null;
  stock: number | null;
  image: File | null;
  farmId: string;
};

export function useProductForm(t: any, router: any) {
  const [form, setForm] = useState<ProductForm>({
    title: "",
    description: "",
    roastLevel: "",
    grindType: "WHOLE",
    price: null,
    stock: null,
    image: null,
    farmId: "",
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function updateField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => {
        const newErr = { ...prev };
        delete newErr[key];
        return newErr;
      });
    }
  }

  function handleText(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    updateField(e.target.name as keyof ProductForm, e.target.value);
  }

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    updateField(e.target.name as keyof ProductForm, e.target.value);
  }

  function handleNumber(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value === "" ? null : Number(e.target.value);
    updateField(e.target.name as keyof ProductForm, value);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    updateField("image", file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!form.title.trim()) newErrors.title = t("my_products.add.error_title_required");
    if (!form.roastLevel) newErrors.roastLevel = t("my_products.add.error_roast_level_required");
    if (!form.grindType) newErrors.grindType = t("my_products.add.error_grind_type_required");

    if (form.price == null || form.price <= 0) {
      newErrors.price = t("my_products.add.error_price_invalid");
    }

    if (form.stock == null || form.stock < 0) {
      newErrors.stock = t("my_products.add.error_stock_invalid");
    }

    if (!form.farmId) newErrors.farmId = t("my_products.add.error_farm_required");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    try {
      await productService.createProduct(
        {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          roastLevel: form.roastLevel,
          grindType: form.grindType as GrindType,
          price: form.price!,
          currentStock: form.stock!,
          farmId: form.farmId,
        },
        form.image || undefined
      );

      router.push("/seller/my-products");
    } catch (err) {
      const apiError = err as ApiError;
      setErrors({
        general: t(`api_errors.${apiError.code}`),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return {
    form,
    errors,
    imagePreview,
    submitting,

    handleText,
    handleSelect,
    handleNumber,
    handleImageChange,
    handleSubmit,
  };
}
