import { Collection, ObjectId } from "mongodb";

type CartInput = {
  code?: number;
  product?: {
    cover: {
      url: string;
    };
    name: string;
    slug: string;
    quantity: number;
    sous_total: number;
    total: number;
  }[];
};

export type Cart = CartInput & {
  _id: ObjectId;
};

export default class CartModel {
  private collection: Collection;

  constructor(collection: Collection) {
    this.collection = collection;
  }
}
