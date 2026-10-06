/** Serializable product data shared by the homepage server and client. */
export interface HomeProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  original_price: number | null;
  stock: number;
  status: string;
  main_image: string | null;
  shipping_type: string;
  shipping_cost: number;
}

export interface HomeUpcoming {
  id: string;
  name: string;
  brand: string;
  main_image: string | null;
  open_label: string;
}
