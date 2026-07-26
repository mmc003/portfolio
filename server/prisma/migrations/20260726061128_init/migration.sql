-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "altText" TEXT NOT NULL DEFAULT '',
    "originalFilename" TEXT NOT NULL,
    "category" TEXT,
    "objectKey" TEXT NOT NULL,
    "thumbnailObjectKey" TEXT,
    "mediumObjectKey" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "aspectRatio" REAL NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "camera" TEXT,
    "lens" TEXT,
    "location" TEXT,
    "capturedAt" DATETIME,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "dominantColor" TEXT,
    "blurPlaceholder" TEXT,
    "contentHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Image_objectKey_key" ON "Image"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "Image_contentHash_key" ON "Image"("contentHash");

-- CreateIndex
CREATE INDEX "Image_isPublished_displayOrder_createdAt_idx" ON "Image"("isPublished", "displayOrder", "createdAt");

-- CreateIndex
CREATE INDEX "Image_category_idx" ON "Image"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Image_createdAt_id_key" ON "Image"("createdAt", "id");
