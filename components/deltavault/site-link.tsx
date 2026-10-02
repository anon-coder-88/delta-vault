import {forwardRef,type ComponentPropsWithoutRef} from 'react';

// Static pages use browser navigation. This avoids the production RSC link
// runtime and also provides working destinations before React has hydrated.
const SiteLink=forwardRef<HTMLAnchorElement,ComponentPropsWithoutRef<'a'>>(
 function SiteLink(props,ref){return <a ref={ref} {...props}/>}
);
export default SiteLink;
