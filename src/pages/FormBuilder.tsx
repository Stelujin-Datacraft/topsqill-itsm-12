
import { useParams } from 'react-router-dom';
import { FormBuilder } from '@/components/FormBuilder';
import { DesktopOnlyNotice } from '@/components/DesktopOnlyNotice';

const FormBuilderPage = () => {
  const { id } = useParams();
  
  return (
    <DesktopOnlyNotice
      toolName="Form Builder"
      description="Building and editing forms requires drag-and-drop and a wide canvas. Please use a tablet or desktop."
    >
      <FormBuilder formId={id} />
    </DesktopOnlyNotice>
  );
};

export default FormBuilderPage;
