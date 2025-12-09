import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield, FileText, Lock, Eye, Users, Mail } from "lucide-react";

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('common.back')}
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <div className="text-center mb-8">
            <Shield className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="text-privacy-title">
              {t('privacy.title')}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t('privacy.lastUpdated')}: {new Date().toLocaleDateString()}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t('privacy.introduction.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p>{t('privacy.introduction.content')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                {t('privacy.dataCollection.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p>{t('privacy.dataCollection.content')}</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>{t('privacy.dataCollection.items.account')}</li>
                <li>{t('privacy.dataCollection.items.usage')}</li>
                <li>{t('privacy.dataCollection.items.documents')}</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                {t('privacy.dataProcessing.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p>{t('privacy.dataProcessing.content')}</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>{t('privacy.dataProcessing.items.ai')}</li>
                <li>{t('privacy.dataProcessing.items.storage')}</li>
                <li>{t('privacy.dataProcessing.items.security')}</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t('privacy.userRights.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p>{t('privacy.userRights.content')}</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>{t('privacy.userRights.items.access')}</li>
                <li>{t('privacy.userRights.items.rectification')}</li>
                <li>{t('privacy.userRights.items.erasure')}</li>
                <li>{t('privacy.userRights.items.portability')}</li>
                <li>{t('privacy.userRights.items.objection')}</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t('privacy.thirdPartyData.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p>{t('privacy.thirdPartyData.content')}</p>
              <div className="bg-muted/50 p-4 rounded-lg mt-4 border">
                <p className="font-medium text-sm">{t('privacy.thirdPartyData.warning')}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                {t('privacy.contact.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p>{t('privacy.contact.content')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
