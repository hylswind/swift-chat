import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  DrawerContentComponentProps,
  useDrawerStatus,
} from '@react-navigation/drawer';
import { Chat, ChatMode } from '../types/Chat.ts';
import {
  deleteMessagesBySessionId,
  getMessageList,
  getSessionId,
  updateMessageList,
} from '../storage/StorageUtils.ts';
import Dialog from 'react-native-dialog';
import { useAppContext } from './AppProvider.tsx';
import { trigger } from '../chat/util/HapticUtils.ts';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src';
import { groupMessagesByDate } from './HistoryGroupUtil.ts';
import { isMac } from '../App.tsx';
import { DrawerActions } from '@react-navigation/native';
import { useTheme, ColorScheme } from '../theme';

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = ({
  navigation,
}) => {
  const { colors, isDark } = useTheme();
  const [groupChatHistory, setGroupChatHistory] = useState<Chat[]>([]);
  const groupChatHistoryRef = useRef(groupChatHistory);
  const chatHistoryRef = useRef(getMessageList());
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const deleteIdRef = useRef<number>(0);
  const drawerStatus = useDrawerStatus();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const tapIndexRef = useRef<number>(1);
  const isFirstRenderRef = useRef<boolean>(true);
  const isSlideDrawerEnabledRef = useRef<boolean>(false);
  const { event, sendEvent } = useAppContext();
  const { drawerType, setDrawerType } = useAppContext();

  const drawerTypeRef = useRef(drawerType);
  const setDrawerTypeRef = useRef(setDrawerType);
  useEffect(() => {
    drawerTypeRef.current = drawerType;
  }, [drawerType]);

  useEffect(() => {
    groupChatHistoryRef.current = groupChatHistory;
  }, [groupChatHistory]);

  useEffect(() => {
    if (event?.event === 'updateHistory') {
      handleUpdateHistory();
    } else if (event?.event === 'updateHistorySelectedId') {
      setSelectedId(event.params?.id ?? null);
    }
  }, [event]);

  useEffect(() => {
    if (isMac && isFirstRenderRef.current) {
      handleUpdateHistory();
      isFirstRenderRef.current = false;
      return;
    }
    if (isMac) {
      if (isSlideDrawerEnabledRef.current) {
        isSlideDrawerEnabledRef.current = false;
        return;
      }
      if (drawerTypeRef.current === 'permanent') {
        setTimeout(() => {
          setDrawerTypeRef.current('slide');
          navigation.dispatch(DrawerActions.toggleDrawer());
        }, 10);
      }
      isSlideDrawerEnabledRef.current = true;
    }

    if (drawerStatus === 'open') {
      trigger(HapticFeedbackTypes.soft);
      trigger(HapticFeedbackTypes.selection);
      if (
        groupChatHistoryRef.current.length > 1 &&
        getSessionId() === groupChatHistoryRef.current[1].id
      ) {
        return;
      }
      handleUpdateHistory();
    } else {
      trigger(HapticFeedbackTypes.selection);
      trigger(HapticFeedbackTypes.soft);
    }
  }, [drawerStatus, navigation]);

  const handleUpdateHistory = () => {
    const messageList = getMessageList();
    chatHistoryRef.current = messageList;
    const flatListData = groupMessagesByDate(messageList);
    setGroupChatHistory(flatListData);
  };

  const setDrawerToPermanent = () => {
    if (isMac && drawerType === 'slide') {
      setDrawerType('permanent');
    }
  };

  const handleDelete = () => {
    // update ui
    setGroupChatHistory(prevHistory =>
      prevHistory.filter(chat => chat.id !== deleteIdRef.current)
    );
    sendEvent('deleteChat', { id: deleteIdRef.current });

    // update storage
    chatHistoryRef.current = chatHistoryRef.current.filter(
      chat => chat.id !== deleteIdRef.current
    );
    updateMessageList(chatHistoryRef.current);
    deleteMessagesBySessionId(deleteIdRef.current);

    trigger(HapticFeedbackTypes.soft);
    deleteIdRef.current = 0;
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={[isMac ? styles.macContainer : styles.safeArea]}>
      <FlatList
        data={groupChatHistory}
        style={styles.flatList}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={
          <View>
            <TouchableOpacity
              style={styles.settingsTouch}
              onPress={() => {
                setDrawerToPermanent();
                navigation.navigate('Bedrock', {
                  sessionId: -1,
                  tapIndex: -1,
                  mode: ChatMode.Text,
                });
              }}>
              <Image
                source={
                  isDark
                    ? require('../assets/sugarapple_dark.png')
                    : require('../assets/sugarapple.png')
                }
                style={styles.settingsLeftImg}
              />
              <Text style={styles.settingsText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsTouch}
              onPress={() => {
                setDrawerToPermanent();
                navigation.navigate('Bedrock', {
                  sessionId: -1,
                  tapIndex: -2,
                  mode: ChatMode.Image,
                });
              }}>
              <Image
                source={
                  isDark
                    ? require('../assets/image_dark.png')
                    : require('../assets/image.png')
                }
                style={styles.settingsLeftImg}
              />
              <Text style={styles.settingsText}>Image</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          if (item.id < 0) {
            return (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionDivider} />
                <Text style={styles.sectionText}>{item.title}</Text>
              </View>
            );
          } else {
            const isSelected = selectedId === item.id;
            return (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => {
                  setSelectedId(item.id);
                  setDrawerToPermanent();
                  setTimeout(() => {
                    navigation.navigate('Bedrock', {
                      sessionId: item.id,
                      tapIndex: tapIndexRef.current,
                      mode: item.mode,
                    });
                    tapIndexRef.current += 1;
                  }, 0);
                }}
                onLongPress={gestureEvent => {
                  trigger(HapticFeedbackTypes.notificationWarning);
                  gestureEvent.preventDefault();
                  setShowDialog(true);
                  deleteIdRef.current = item.id;
                }}
                style={[
                  styles.touch,
                  isSelected &&
                    (isMac ? styles.macTouchSelected : styles.touchSelected),
                ]}>
                <Text numberOfLines={1} style={styles.title}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          }
        }}
      />
      <TouchableOpacity
        style={styles.settingsTouch}
        onPress={() => {
          setDrawerToPermanent();
          navigation.navigate('Settings');
        }}>
        <Image
          source={
            isDark
              ? require('../assets/settings_dark.png')
              : require('../assets/settings.png')
          }
          style={styles.settingsLeftImg}
        />
        <Text style={styles.settingsText}>Settings</Text>
      </TouchableOpacity>
      <Dialog.Container visible={showDialog}>
        <Dialog.Title>Delete Message</Dialog.Title>
        <Dialog.Description>You cannot undo this action.</Dialog.Description>
        <Dialog.Button
          label="Cancel"
          onPress={() => {
            setShowDialog(false);
          }}
        />
        <Dialog.Button
          label="Delete"
          onPress={() => {
            handleDelete();
            setShowDialog(false);
          }}
        />
      </Dialog.Container>
    </SafeAreaView>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.drawerBackground,
    },
    macContainer: {
      flex: 1,
      backgroundColor: colors.drawerBackgroundMac,
    },
    settingsTouch: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginVertical: 12,
      paddingHorizontal: 18,
    },
    settingsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingsText: {
      fontSize: 16,
      marginHorizontal: 8,
      fontWeight: '500',
      color: colors.text,
    },
    settingsLeftImg: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    settingsRightImg: {
      width: 16,
      height: 16,
      marginRight: 8,
    },
    flatList: {
      marginVertical: 4,
    },
    touch: {
      paddingHorizontal: 8,
      paddingVertical: 12,
      marginHorizontal: 12,
      marginVertical: 2,
      borderRadius: 8,
    },
    touchSelected: {
      backgroundColor: colors.selectedBackground,
    },
    macTouchSelected: {
      backgroundColor: colors.selectedBackgroundMac,
    },
    sectionContainer: {
      paddingHorizontal: 8,
      marginHorizontal: 12,
      marginVertical: 12,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    sectionText: {
      marginTop: 17,
      fontSize: 14,
      color: colors.textSecondary,
    },
    title: {
      fontSize: 16,
      color: colors.text,
    },
  });

export default CustomDrawerContent;
