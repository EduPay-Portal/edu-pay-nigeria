import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Smartphone, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';

export function PaymentInstructions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Payment Instructions
        </CardTitle>
        <CardDescription>How to fund your wallet</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="bank-transfer">
            <AccordionTrigger className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Bank Transfer
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-sm">Open your banking app or visit your bank</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-sm">Select "Transfer" or "Send Money"</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-sm">Enter your virtual account number and bank name</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-sm">Enter the amount you wish to transfer</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-sm">Complete the transaction</p>
                </div>
              </div>
              <div className="bg-warning/10 border border-warning/20 rounded-md p-3">
                <p className="text-xs text-warning-foreground">
                  ⏱️ Payments typically reflect within 5-30 minutes
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="mobile-banking">
            <AccordionTrigger className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Mobile Banking / USSD
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-sm">You can also use USSD codes or mobile banking apps:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-sm">Dial your bank's USSD code (e.g., *737# for GTBank)</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-sm">Select "Transfer" option</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-sm">Enter your virtual account number</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                  <p className="text-sm">Enter amount and complete with PIN</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="important-notes">
            <AccordionTrigger className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Important Notes
            </AccordionTrigger>
            <AccordionContent className="space-y-2">
              <div className="space-y-2">
                <p className="text-sm">• Only send payments from bank accounts registered in your name</p>
                <p className="text-sm">• Save your virtual account number for future payments</p>
                <p className="text-sm">• You'll receive a notification once payment is credited</p>
                <p className="text-sm">• For urgent issues, contact school administration</p>
              </div>
              <div className="bg-success/10 border border-success/20 rounded-md p-3 mt-3">
                <p className="text-xs text-success-foreground">
                  ✓ Your virtual account is unique to you and can be reused for all payments
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
