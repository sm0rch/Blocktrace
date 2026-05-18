/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- DropTable
DROP TABLE [dbo].[User];

-- CreateTable
CREATE TABLE [dbo].[PRODUCER] (
    [producer_id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [phone_number] NVARCHAR(1000) NOT NULL,
    [origin_location] NVARCHAR(1000),
    [full_name] NVARCHAR(1000),
    [company_name] NVARCHAR(1000) NOT NULL,
    [business_license] NVARCHAR(1000) NOT NULL,
    [tax_code] NVARCHAR(1000) NOT NULL,
    [certification_list] NVARCHAR(1000),
    [reputation_score] FLOAT(53) NOT NULL CONSTRAINT [PRODUCER_reputation_score_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [PRODUCER_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PRODUCER_pkey] PRIMARY KEY CLUSTERED ([producer_id]),
    CONSTRAINT [PRODUCER_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [PRODUCER_phone_number_key] UNIQUE NONCLUSTERED ([phone_number]),
    CONSTRAINT [PRODUCER_company_name_key] UNIQUE NONCLUSTERED ([company_name]),
    CONSTRAINT [PRODUCER_business_license_key] UNIQUE NONCLUSTERED ([business_license]),
    CONSTRAINT [PRODUCER_tax_code_key] UNIQUE NONCLUSTERED ([tax_code])
);

-- CreateTable
CREATE TABLE [dbo].[CARRIER] (
    [carrier_id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [phone_number] NVARCHAR(1000) NOT NULL,
    [company_name] NVARCHAR(1000) NOT NULL,
    [business_license] NVARCHAR(1000) NOT NULL,
    [tax_code] NVARCHAR(1000) NOT NULL,
    [vehicle_list] NVARCHAR(1000),
    [cold_chain_cert] NVARCHAR(1000),
    [reputation_score] FLOAT(53) NOT NULL CONSTRAINT [CARRIER_reputation_score_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [CARRIER_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CARRIER_pkey] PRIMARY KEY CLUSTERED ([carrier_id]),
    CONSTRAINT [CARRIER_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [CARRIER_phone_number_key] UNIQUE NONCLUSTERED ([phone_number]),
    CONSTRAINT [CARRIER_company_name_key] UNIQUE NONCLUSTERED ([company_name]),
    CONSTRAINT [CARRIER_business_license_key] UNIQUE NONCLUSTERED ([business_license]),
    CONSTRAINT [CARRIER_tax_code_key] UNIQUE NONCLUSTERED ([tax_code])
);

-- CreateTable
CREATE TABLE [dbo].[CUSTOMER] (
    [customer_id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [phone_number] NVARCHAR(1000) NOT NULL,
    [full_name] NVARCHAR(1000),
    [origin_location] NVARCHAR(1000),
    [customer_type] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [CUSTOMER_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CUSTOMER_pkey] PRIMARY KEY CLUSTERED ([customer_id]),
    CONSTRAINT [CUSTOMER_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [CUSTOMER_phone_number_key] UNIQUE NONCLUSTERED ([phone_number])
);

-- CreateTable
CREATE TABLE [dbo].[BATCH_NFT] (
    [tokenId] NVARCHAR(1000) NOT NULL,
    [producer_id] NVARCHAR(1000) NOT NULL,
    [productName] NVARCHAR(1000),
    [origin] NVARCHAR(1000),
    [harvestDate] DATE,
    [certification] NVARCHAR(1000),
    [batchNumber] NVARCHAR(1000),
    [blockchain_tx_hash] NVARCHAR(1000) NOT NULL,
    [smart_contract_address] NVARCHAR(1000) NOT NULL,
    [metadata_ipfs_cid] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [BATCH_NFT_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [BATCH_NFT_pkey] PRIMARY KEY CLUSTERED ([tokenId]),
    CONSTRAINT [BATCH_NFT_blockchain_tx_hash_key] UNIQUE NONCLUSTERED ([blockchain_tx_hash])
);

-- CreateTable
CREATE TABLE [dbo].[QR_CODE] (
    [qr_id] NVARCHAR(1000) NOT NULL,
    [tokenId] NVARCHAR(1000) NOT NULL,
    [url] NVARCHAR(1000) NOT NULL,
    [generated_at] DATETIME2 NOT NULL CONSTRAINT [QR_CODE_generated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [QR_CODE_pkey] PRIMARY KEY CLUSTERED ([qr_id]),
    CONSTRAINT [QR_CODE_tokenId_key] UNIQUE NONCLUSTERED ([tokenId])
);

-- CreateTable
CREATE TABLE [dbo].[TRANSACTION] (
    [tx_id] NVARCHAR(1000) NOT NULL,
    [tokenId] NVARCHAR(1000) NOT NULL,
    [carrier_id] NVARCHAR(1000) NOT NULL,
    [customer_id] NVARCHAR(1000) NOT NULL,
    [escrow_status] NVARCHAR(1000) NOT NULL,
    [escrow_amount] DECIMAL(38,0) NOT NULL,
    [payment_released_at] DATETIME2,
    [payment_released_reason] NVARCHAR(1000),
    [blockchain_tx_hash] NVARCHAR(1000) NOT NULL,
    [smart_contract_address] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [TRANSACTION_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [TRANSACTION_pkey] PRIMARY KEY CLUSTERED ([tx_id]),
    CONSTRAINT [TRANSACTION_blockchain_tx_hash_key] UNIQUE NONCLUSTERED ([blockchain_tx_hash])
);

-- CreateTable
CREATE TABLE [dbo].[BILLING_DETAIL] (
    [billing_id] NVARCHAR(1000) NOT NULL,
    [tx_id] NVARCHAR(1000) NOT NULL,
    [flat_fee] DECIMAL(38,0) NOT NULL CONSTRAINT [BILLING_DETAIL_flat_fee_df] DEFAULT 0,
    [logistics_fee] DECIMAL(38,0) NOT NULL CONSTRAINT [BILLING_DETAIL_logistics_fee_df] DEFAULT 0,
    [tax_amount] DECIMAL(38,0) NOT NULL CONSTRAINT [BILLING_DETAIL_tax_amount_df] DEFAULT 0,
    [total_amount] DECIMAL(38,0) NOT NULL CONSTRAINT [BILLING_DETAIL_total_amount_df] DEFAULT 0,
    [invoice_url] NVARCHAR(1000),
    [refund_amount] DECIMAL(38,0) NOT NULL CONSTRAINT [BILLING_DETAIL_refund_amount_df] DEFAULT 0,
    [refund_reason] NVARCHAR(1000),
    [billing_status] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [BILLING_DETAIL_pkey] PRIMARY KEY CLUSTERED ([billing_id]),
    CONSTRAINT [BILLING_DETAIL_tx_id_key] UNIQUE NONCLUSTERED ([tx_id])
);

-- CreateTable
CREATE TABLE [dbo].[SHIPMENT_LOG] (
    [log_id] NVARCHAR(1000) NOT NULL,
    [tx_id] NVARCHAR(1000) NOT NULL,
    [tokenId] NVARCHAR(1000) NOT NULL,
    [temperature_logs] NVARCHAR(1000),
    [humidity_logs] NVARCHAR(1000),
    [gps_trucking] NVARCHAR(1000),
    [door_open_close] NVARCHAR(1000),
    [logistics_documents] NVARCHAR(1000),
    [logged_at] DATETIME2 NOT NULL CONSTRAINT [SHIPMENT_LOG_logged_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SHIPMENT_LOG_pkey] PRIMARY KEY CLUSTERED ([log_id])
);

-- CreateTable
CREATE TABLE [dbo].[ISSUE_REPORT] (
    [issue_id] NVARCHAR(1000) NOT NULL,
    [tokenId] NVARCHAR(1000) NOT NULL,
    [reporter_type] NVARCHAR(1000) NOT NULL,
    [reporter_id] NVARCHAR(1000) NOT NULL,
    [issue_type] NVARCHAR(1000) NOT NULL,
    [issue_description] NVARCHAR(1000),
    [evidence_ipfs_cid] NVARCHAR(1000),
    [inspection_report_url] NVARCHAR(1000),
    [issue_status] NVARCHAR(1000) NOT NULL,
    [blockchain_tx_hash] NVARCHAR(1000),
    [reported_at] DATETIME2 NOT NULL CONSTRAINT [ISSUE_REPORT_reported_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ISSUE_REPORT_pkey] PRIMARY KEY CLUSTERED ([issue_id])
);

-- CreateTable
CREATE TABLE [dbo].[RESOLUTION] (
    [resolution_id] NVARCHAR(1000) NOT NULL,
    [issue_id] NVARCHAR(1000) NOT NULL,
    [resolution_type] NVARCHAR(1000) NOT NULL,
    [resolved_by] NVARCHAR(1000) NOT NULL,
    [resolution_description] NVARCHAR(1000),
    [settlement_doc_url] NVARCHAR(1000),
    [financial_impact] NVARCHAR(1000) NOT NULL,
    [refund_amount] DECIMAL(38,0) NOT NULL CONSTRAINT [RESOLUTION_refund_amount_df] DEFAULT 0,
    [recall_batch] BIT NOT NULL CONSTRAINT [RESOLUTION_recall_batch_df] DEFAULT 0,
    [blockchain_tx_hash] NVARCHAR(1000),
    [resolved_at] DATETIME2,
    CONSTRAINT [RESOLUTION_pkey] PRIMARY KEY CLUSTERED ([resolution_id]),
    CONSTRAINT [RESOLUTION_issue_id_key] UNIQUE NONCLUSTERED ([issue_id])
);

-- CreateTable
CREATE TABLE [dbo].[QUERY_HISTORY] (
    [query_id] NVARCHAR(1000) NOT NULL,
    [tokenId] NVARCHAR(1000) NOT NULL,
    [queried_by_type] NVARCHAR(1000) NOT NULL,
    [queried_by_id] NVARCHAR(1000),
    [metadata_hash_verified] NVARCHAR(1000) NOT NULL,
    [integrity_check] BIT NOT NULL CONSTRAINT [QUERY_HISTORY_integrity_check_df] DEFAULT 0,
    [queried_at] DATETIME2 NOT NULL CONSTRAINT [QUERY_HISTORY_queried_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [QUERY_HISTORY_pkey] PRIMARY KEY CLUSTERED ([query_id])
);

-- CreateTable
CREATE TABLE [dbo].[REPUTATION_LOG] (
    [log_id] NVARCHAR(1000) NOT NULL,
    [subject_type] NVARCHAR(1000) NOT NULL,
    [subject_id] NVARCHAR(1000) NOT NULL,
    [tokenId] NVARCHAR(1000) NOT NULL,
    [resolution_id] NVARCHAR(1000) NOT NULL,
    [score_before] FLOAT(53) NOT NULL,
    [score_after] FLOAT(53) NOT NULL,
    [score_delta] FLOAT(53) NOT NULL,
    [reason] NVARCHAR(1000),
    [logged_at] DATETIME2 NOT NULL CONSTRAINT [REPUTATION_LOG_logged_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [REPUTATION_LOG_pkey] PRIMARY KEY CLUSTERED ([log_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_batch_tokenId] ON [dbo].[BATCH_NFT]([tokenId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_tx_tokenId] ON [dbo].[TRANSACTION]([tokenId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_shiplog_tokenId] ON [dbo].[SHIPMENT_LOG]([tokenId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_issue_tokenId] ON [dbo].[ISSUE_REPORT]([tokenId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_query_tokenId] ON [dbo].[QUERY_HISTORY]([tokenId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_rep_subject] ON [dbo].[REPUTATION_LOG]([subject_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_rep_tokenId] ON [dbo].[REPUTATION_LOG]([tokenId]);

-- AddForeignKey
ALTER TABLE [dbo].[BATCH_NFT] ADD CONSTRAINT [BATCH_NFT_producer_id_fkey] FOREIGN KEY ([producer_id]) REFERENCES [dbo].[PRODUCER]([producer_id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[QR_CODE] ADD CONSTRAINT [QR_CODE_tokenId_fkey] FOREIGN KEY ([tokenId]) REFERENCES [dbo].[BATCH_NFT]([tokenId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TRANSACTION] ADD CONSTRAINT [TRANSACTION_tokenId_fkey] FOREIGN KEY ([tokenId]) REFERENCES [dbo].[BATCH_NFT]([tokenId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TRANSACTION] ADD CONSTRAINT [TRANSACTION_carrier_id_fkey] FOREIGN KEY ([carrier_id]) REFERENCES [dbo].[CARRIER]([carrier_id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TRANSACTION] ADD CONSTRAINT [TRANSACTION_customer_id_fkey] FOREIGN KEY ([customer_id]) REFERENCES [dbo].[CUSTOMER]([customer_id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BILLING_DETAIL] ADD CONSTRAINT [BILLING_DETAIL_tx_id_fkey] FOREIGN KEY ([tx_id]) REFERENCES [dbo].[TRANSACTION]([tx_id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SHIPMENT_LOG] ADD CONSTRAINT [SHIPMENT_LOG_tx_id_fkey] FOREIGN KEY ([tx_id]) REFERENCES [dbo].[TRANSACTION]([tx_id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SHIPMENT_LOG] ADD CONSTRAINT [SHIPMENT_LOG_tokenId_fkey] FOREIGN KEY ([tokenId]) REFERENCES [dbo].[BATCH_NFT]([tokenId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ISSUE_REPORT] ADD CONSTRAINT [ISSUE_REPORT_tokenId_fkey] FOREIGN KEY ([tokenId]) REFERENCES [dbo].[BATCH_NFT]([tokenId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RESOLUTION] ADD CONSTRAINT [RESOLUTION_issue_id_fkey] FOREIGN KEY ([issue_id]) REFERENCES [dbo].[ISSUE_REPORT]([issue_id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[QUERY_HISTORY] ADD CONSTRAINT [QUERY_HISTORY_tokenId_fkey] FOREIGN KEY ([tokenId]) REFERENCES [dbo].[BATCH_NFT]([tokenId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[REPUTATION_LOG] ADD CONSTRAINT [REPUTATION_LOG_tokenId_fkey] FOREIGN KEY ([tokenId]) REFERENCES [dbo].[BATCH_NFT]([tokenId]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[REPUTATION_LOG] ADD CONSTRAINT [REPUTATION_LOG_resolution_id_fkey] FOREIGN KEY ([resolution_id]) REFERENCES [dbo].[RESOLUTION]([resolution_id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
