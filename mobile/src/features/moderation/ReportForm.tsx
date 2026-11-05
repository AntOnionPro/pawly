import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors } from '@/api/errors';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { FieldError } from '@/components/FieldError';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

import {
  isAlreadyReported,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  type ReportReason,
  type ReportTarget,
} from './api';
import { useSendReport } from './hooks';

interface ReportFormProps {
  target: ReportTarget;
  /** A reason chosen beforehand (such as an overdue adoption follow-up): the only one offered. */
  reason?: ReportReason;
  onSent: () => void;
}

/** Reason (required) and optional details for a report. */
export function ReportForm({ target, reason: fixedReason, onSent }: ReportFormProps) {
  const { t } = useTranslation();
  const send = useSendReport();
  const [reason, setReason] = useState<ReportReason | ''>(fixedReason ?? '');
  const reasons = fixedReason ? [fixedReason] : REPORT_REASONS;
  const [details, setDetails] = useState('');
  const [missingReason, setMissingReason] = useState(false);

  async function submit() {
    if (!reason) {
      setMissingReason(true);
      return;
    }
    try {
      await send.mutateAsync({ target, reason, details });
      onSent();
    } catch {
      // The error is shown above the button.
    }
  }

  const errorKey = !send.error
    ? null
    : isAlreadyReported(send.error)
      ? 'errors.alreadyReported'
      : (Object.values(toFieldErrors(send.error))[0] ??
        requestErrorKey(requestErrorKind(send.error)) ??
        'errors.generic');

  return (
    <View style={styles.form}>
      <ThemedText variant="heading">{t(`report.question.${target.kind}`)}</ThemedText>
      <ChipGroup
        label={t('report.reason')}
        chips={reasons.map((value) => ({ value, label: t(`report.reasons.${value}`) }))}
        selected={reason}
        onSelect={(value) => {
          setReason(value);
          setMissingReason(false);
        }}
        error={missingReason ? t('report.chooseReason') : null}
      />
      <TextField
        label={t('report.details')}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={REPORT_DETAILS_MAX}
      />
      <FieldError message={errorKey ? t(errorKey) : null} />
      <Button
        label={t('report.send')}
        icon="flag"
        loading={send.isPending}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
