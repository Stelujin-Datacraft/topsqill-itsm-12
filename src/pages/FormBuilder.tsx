
import { useParams } from 'react-router-dom';
import { FormBuilder } from '@/components/FormBuilder';

const FormBuilderPage = () => {
  const { id } = useParams();
  
  return <FormBuilder formId={id} />;
};

export default FormBuilderPage;
