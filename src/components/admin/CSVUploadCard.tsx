import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, AlertCircle, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import Papa from "papaparse";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CSVRow {
  SN: string;
  SURNAME: string;
  NAMES: string;
  CLASS: string;
  "REG NO": string;
  "MEMBER/NMEMBER": string;
  "DAY/BOARDER": string;
  "SCHOOL FEES": string;
  DEBTS: string;
}

interface CSVUploadCardProps {
  onUploadComplete: () => void;
}

export function CSVUploadCard({ onUploadComplete }: CSVUploadCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CSVRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const requiredColumns = ["SN", "SURNAME", "NAMES", "CLASS", "REG NO", "MEMBER/NMEMBER", "DAY/BOARDER", "SCHOOL FEES", "DEBTS"];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please select a valid CSV file");
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Parse CSV for preview
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as CSVRow[];
        
        // Validate columns
        const headers = Object.keys(data[0] || {});
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          setError(`Missing required columns: ${missingColumns.join(", ")}`);
          setPreviewData([]);
          return;
        }

        setPreviewData(data.slice(0, 10)); // Preview first 10 rows
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`);
      }
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Wrap Papa.parse in Promise for proper async handling
      const csvData = await new Promise<CSVRow[]>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data as CSVRow[]),
          error: (err) => reject(err)
        });
      });

      // Generate parent emails and prepare staging records
      const stagingRecords = csvData.map((row) => ({
        "SN": row.SN,
        "SURNAME": row.SURNAME,
        "NAMES": row.NAMES,
        "CLASS": row.CLASS,
        "REG NO": row["REG NO"],
        "MEMBER/NMEMBER": row["MEMBER/NMEMBER"],
        "DAY/BOARDER": row["DAY/BOARDER"],
        "SCHOOL FEES": row["SCHOOL FEES"],
        "DEBTS": row.DEBTS || "0",
        parent_email: `${row.SURNAME.toLowerCase().replace(/\s+/g, '')}.parent@edupay.school`,
        processed: false,
      }));

      console.log('Uploading records:', stagingRecords.length);
      console.log('Sample record:', stagingRecords[0]);

      // Insert in batches to show progress
      const batchSize = 50;
      const totalBatches = Math.ceil(stagingRecords.length / batchSize);
      let uploadedCount = 0;

      for (let i = 0; i < stagingRecords.length; i += batchSize) {
        const batch = stagingRecords.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;
        
        const { error: insertError } = await supabase
          .from("students_import_staging")
          .insert(batch);

        if (insertError) {
          console.error('Insert error:', insertError);
          throw new Error(`Batch ${currentBatch} failed: ${insertError.message}`);
        }

        uploadedCount += batch.length;
        setProgress((currentBatch / totalBatches) * 100);
      }

      toast({
        title: "✓ Upload Successful",
        description: `Successfully uploaded ${uploadedCount} student records to staging.`,
      });

      setFile(null);
      setPreviewData([]);
      onUploadComplete();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      console.error('Upload failed:', err);
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: errorMessage,
      });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const handleClearStaging = async () => {
    try {
      const { error } = await supabase
        .from("students_import_staging")
        .delete()
        .neq("SN", ""); // Delete all records

      if (error) throw error;

      toast({
        title: "Staging Cleared",
        description: "All staging records have been deleted.",
      });

      onUploadComplete();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to Clear",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload CSV File
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Staging
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All Staging Records?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all records from the staging table. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearStaging}>Clear All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardTitle>
        <CardDescription>
          Upload a CSV file with student data. Required columns: SN, SURNAME, NAMES, CLASS, REG NO, MEMBER/NMEMBER, DAY/BOARDER, SCHOOL FEES, DEBTS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="flex-1"
          />
          {file && (
            <Button 
              onClick={handleUpload} 
              disabled={isUploading || previewData.length === 0}
              className="min-w-[160px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload to Staging
                </>
              )}
            </Button>
          )}
        </div>

        {isUploading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              Uploading... {Math.round(progress)}%
            </p>
          </div>
        )}

        {file && previewData.length > 0 && !isUploading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Preview: {file.name} ({previewData.length} rows shown)</span>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">SN</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Class</th>
                    <th className="p-2 text-left">Reg No</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{row.SN}</td>
                      <td className="p-2">{row.SURNAME} {row.NAMES}</td>
                      <td className="p-2">{row.CLASS}</td>
                      <td className="p-2">{row["REG NO"]}</td>
                      <td className="p-2">{row["MEMBER/NMEMBER"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
