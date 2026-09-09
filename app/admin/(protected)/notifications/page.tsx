import {currentAdminSite} from '@/lib/admin-site';
import {SITES} from '@/lib/sites';
import {kakaoChannelUrl} from '@/lib/kakao-commerce';
import KakaoCommercePanel from '@/components/admin/KakaoCommercePanel';
export default async function NotificationsPage(){
 const site=await currentAdminSite();
 const channelUrl=kakaoChannelUrl(site.kakaoUrl);
 return <KakaoCommercePanel siteName={site.name} channelUrl={channelUrl} sharedChannel={!!channelUrl&&kakaoChannelUrl(SITES.blendpick.kakaoUrl)===kakaoChannelUrl(SITES.sanjipick.kakaoUrl)}/>;
}
