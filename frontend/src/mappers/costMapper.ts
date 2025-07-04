const mapFormDataToCostData = (formData: {
  contractor: string;
  nip: string;
  invoiceNumber: string;
  amount: string;
  month: string;
  costType: string;
  description: string;
  costOwner: string;
  representative: string;
  department: string;
  year: number;
  author: string;
}) => {
  return {
    cost_year: formData.year,
    cost_contrahent: formData.contractor,
    cost_nip: formData.nip,
    cost_mo: Number(formData.month),
    cost_doc_no: formData.invoiceNumber,
    cost_value: Number(formData.amount),
    cost_kind: formData.costType,
    cost_4what: formData.description,
    cost_own: formData.costOwner,
    cost_ph: formData.representative === 'none' ? null : formData.representative,
    cost_author: formData.author,
    cost_branch: formData.department
  };
};

export { mapFormDataToCostData };