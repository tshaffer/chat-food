import mongoose, { Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, unique: true },
  },
  {
    collection: "users",
    timestamps: true,
    versionKey: false,
  },
);

const foodSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, unique: true },
    unitQuantity: { type: Number, required: true, min: 0 },
    unitType: { type: String, required: true, trim: true },
    caloriesPerUnit: { type: Number, required: true, min: 0 },
    proteinPerUnit: { type: Number, required: true, min: 0 },
    fiberPerUnit: { type: Number, required: true, min: 0 },
  },
  {
    collection: "foods",
    timestamps: true,
    versionKey: false,
  },
);

const templateSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
  },
  {
    collection: "templates",
    timestamps: true,
    versionKey: false,
  },
);

const templateItemSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    templateId: { type: String, required: true, index: true },
    lineNumber: { type: Number, required: true, min: 1 },
    foodId: { type: String, required: true, index: true },
    defaultAmount: { type: Number, required: true, min: 0 },
  },
  {
    collection: "templateItems",
    versionKey: false,
  },
);

templateItemSchema.index({ templateId: 1, lineNumber: 1 }, { unique: true });

const nutritionSnapshotSchema = new Schema(
  {
    calories: { type: Number, required: true, min: 0 },
    protein: { type: Number, required: true, min: 0 },
    fiber: { type: Number, required: true, min: 0 },
  },
  { _id: false, versionKey: false },
);

const logEntrySchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    meal: { type: String, required: true, enum: ["Breakfast", "Lunch", "Dinner", "Snack"] },
    templateId: { type: String, default: null, index: true },
    templateNameSnapshot: { type: String, default: null },
    foodId: { type: String, required: true, index: true },
    actualAmount: { type: Number, required: true, min: 0 },
    nutritionSnapshot: { type: nutritionSnapshotSchema, required: true },
  },
  {
    collection: "logEntries",
    timestamps: true,
    versionKey: false,
  },
);

logEntrySchema.index({ userId: 1, date: 1 });

export type UserDocumentShape = InferSchemaType<typeof userSchema>;
export type FoodDocumentShape = InferSchemaType<typeof foodSchema>;
export type TemplateDocumentShape = InferSchemaType<typeof templateSchema>;
export type TemplateItemDocumentShape = InferSchemaType<typeof templateItemSchema>;
export type LogEntryDocumentShape = InferSchemaType<typeof logEntrySchema>;

export const UserModel = mongoose.models.User || mongoose.model("User", userSchema);
export const FoodModel = mongoose.models.Food || mongoose.model("Food", foodSchema);
export const TemplateModel = mongoose.models.Template || mongoose.model("Template", templateSchema);
export const TemplateItemModel =
  mongoose.models.TemplateItem || mongoose.model("TemplateItem", templateItemSchema);
export const LogEntryModel = mongoose.models.LogEntry || mongoose.model("LogEntry", logEntrySchema);
