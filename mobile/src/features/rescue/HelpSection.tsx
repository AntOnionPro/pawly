import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { MessageButton } from '@/features/messages/MessageButton';
import { useBlockedIds } from '@/features/moderation/hooks';
import { UserLink } from '@/features/users/UserLink';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { confirm } from '@/utils/confirm';

import type { RescueReport } from './api';
import { HELP_MESSAGE_MAX, type HelpOffer } from './helpers';
import { useHelpActions, useHelpOffers, useMyOffer } from './hooks';

/** The reporter's list: who offered to help, their message, and a way to write to them. */
function HelperList({ report }: { report: RescueReport }) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { data } = useHelpOffers(report.id, true);
  const blocked = useBlockedIds();
  const offers = (data ?? []).filter((offer) => !blocked.has(offer.helperId));
  return (
    <View style={styles.section}>
      <ThemedText variant="label" color="textSecondary" accessibilityRole="header">
        {t('rescue.help.title')}
      </ThemedText>
      {offers.length === 0 ? (
        <ThemedText color="textSecondary">{t('rescue.help.none')}</ThemedText>
      ) : null}
      {offers.map((offer: HelpOffer) => (
        <View
          key={offer.id}
          style={[styles.offer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {offer.helper ? (
            <UserLink
              user={offer.helper}
              label={`@${offer.helper.username}`}
              onPress={() =>
                router.push({ pathname: '/user/[id]', params: { id: offer.helperId } })
              }
            />
          ) : null}
          {offer.message ? <ThemedText>{offer.message}</ThemedText> : null}
          <MessageButton userId={offer.helperId} />
        </View>
      ))}
    </View>
  );
}

/** Anyone else: "I can help" with an optional message, then a way to withdraw. */
function OfferHelp({ report }: { report: RescueReport }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useAuth();
  const signedIn = status === 'signedIn';
  const { data: mine, isPending } = useMyOffer(report.id, signedIn);
  const { offer, withdraw } = useHelpActions();
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const username = report.reporter?.username ?? '';

  function showError(failure: unknown) {
    const [field] = Object.values(toFieldErrors(failure));
    const key = field ?? requestErrorKey(requestErrorKind(failure)) ?? 'errors.generic';
    setError(`${t('rescue.help.failed')} ${t(key)}`);
  }

  async function send() {
    setError(null);
    try {
      await offer.mutateAsync({ reportId: report.id, message });
      setWriting(false);
      setMessage('');
    } catch (failure) {
      showError(failure);
    }
  }

  async function stop(offerId: string) {
    const confirmed = await confirm({
      title: t('rescue.help.withdrawConfirmTitle'),
      message: t('rescue.help.withdrawConfirmMessage', { username }),
      confirmLabel: t('rescue.help.withdraw'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    setError(null);
    try {
      await withdraw.mutateAsync(offerId);
    } catch (failure) {
      showError(failure);
    }
  }

  if (signedIn && isPending) return null;
  if (mine) {
    return (
      <View style={styles.section}>
        <ThemedText>{t('rescue.help.offered', { username })}</ThemedText>
        <MessageButton userId={report.reporterId} />
        <Button
          variant="link"
          label={t('rescue.help.withdraw')}
          onPress={() => void stop(mine.id)}
          loading={withdraw.isPending}
        />
        <FieldError message={error} />
      </View>
    );
  }
  if (report.status === 'closed') return null;
  if (writing) {
    return (
      <View style={styles.section}>
        <TextField
          label={t('rescue.help.message', { username })}
          hint={t('rescue.help.messageHint')}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={HELP_MESSAGE_MAX}
        />
        <FieldError message={error} />
        <Button
          icon="rescue"
          label={t('rescue.help.send')}
          onPress={() => void send()}
          loading={offer.isPending}
        />
        <Button variant="link" label={t('rescue.help.cancel')} onPress={() => setWriting(false)} />
      </View>
    );
  }
  return (
    <Button
      icon="rescue"
      label={t('rescue.help.can')}
      onPress={() => (signedIn ? setWriting(true) : router.push('/sign-in'))}
    />
  );
}

/** "I can help" on a report of an animal that needs help, and how many offered. */
export function HelpSection({ report }: { report: RescueReport }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (report.kind !== 'help') return null;
  const isReporter = user?.id === report.reporterId;
  return (
    <View style={styles.section}>
      {report.helperCount > 0 ? (
        <ThemedText color="textSecondary">
          {t('rescue.help.count', { count: report.helperCount })}
        </ThemedText>
      ) : null}
      {isReporter ? <HelperList report={report} /> : <OfferHelp report={report} />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  offer: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
